import type { ErpCustomerFieldMap, ErpProjectFieldMap, ErpSyncResourceConfig, ErpSyncResourceResult, ErpSyncSummary } from '../../app/types/erp-connection'
import type { ErpConnectionRow } from './erpConnections'

// Safety cap on paginated responses (DRF-style `next` links), so a misbehaving ERP can't loop forever.
const MAX_PAGES = 100
// Per-resource cap on stored error messages — the counts still cover every record.
const MAX_ERRORS = 20
const PROJECT_STATUSES = ['planned', 'active', 'on_hold', 'completed', 'cancelled']

function getPath(record: unknown, path?: string): unknown {
  if (!path)
    return undefined
  return path.split('.').reduce<unknown>(
    (value, key) => (value && typeof value === 'object') ? (value as Record<string, unknown>)[key] : undefined,
    record,
  )
}

/** Normalizes an ERP value to trimmed text. A nested object (e.g. `customer: { id, name }`) resolves to its id, falling back to its name. */
function asText(value: unknown): string | undefined {
  if (value === null || value === undefined)
    return undefined
  if (typeof value === 'object') {
    const nested = value as Record<string, unknown>
    return asText(nested.id ?? nested.name)
  }
  const text = String(value).trim()
  return text || undefined
}

function asDate(value: unknown): string | undefined {
  const text = asText(value)
  return text && /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : undefined
}

function extractList(body: unknown, listKey?: string): { items: unknown[], next?: string } {
  let list: unknown
  if (listKey?.trim())
    list = getPath(body, listKey.trim())
  else if (Array.isArray(body))
    list = body
  else
    list = ['results', 'data', 'items'].map(key => getPath(body, key)).find(Array.isArray)

  if (!Array.isArray(list)) {
    throw new TypeError(listKey?.trim()
      ? `No list found at "${listKey}" in the response`
      : 'Could not find a list in the response — set "List key" to where the records are')
  }

  const next = body && typeof body === 'object' ? (body as Record<string, unknown>).next : undefined
  return { items: list, next: typeof next === 'string' && next ? next : undefined }
}

async function fetchAllRecords(row: ErpConnectionRow, config: ErpSyncResourceConfig<unknown>) {
  const items: unknown[] = []
  let next: string | undefined = config.path
  let pages = 0

  while (next && pages < MAX_PAGES) {
    const page = extractList(await fetchErpJson(row, next), config.listKey)
    items.push(...page.items)
    next = page.next
    pages++
  }

  return items
}

function emptyResult(): ErpSyncResourceResult {
  return { fetched: 0, created: 0, updated: 0, skipped: 0, errors: [] }
}

function skip(result: ErpSyncResourceResult, message: string) {
  result.skipped++
  if (result.errors.length < MAX_ERRORS)
    result.errors.push(message)
}

interface ExistingClient {
  id: string
  name: string
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  erp_client_id: string | null
}

async function syncCustomers(row: ErpConnectionRow, config: ErpSyncResourceConfig<ErpCustomerFieldMap>) {
  const db = useDatabase()
  const result = emptyResult()
  const records = await fetchAllRecords(row, config)
  result.fetched = records.length

  // Clients not yet linked to any ERP record, keyed by normalized name (server/utils/duplicates.ts),
  // so a hand-entered "Acme Ltd" gets linked to the ERP's "ACME Limited" instead of duplicated.
  const unlinkedRows = await db.prepare('SELECT id, name FROM clients WHERE erp_client_id IS NULL').all() as { id: string, name: string }[]
  const unlinkedByName = new Map(unlinkedRows.map(client => [normalizeName(client.name), client.id]))

  for (const record of records) {
    const erpId = asText(getPath(record, config.idField))
    const name = asText(getPath(record, config.fields.name))
    if (!erpId || !name) {
      skip(result, `Customer skipped: missing ${!erpId ? `id ("${config.idField}")` : `name ("${config.fields.name}")`}`)
      continue
    }

    const contactName = asText(getPath(record, config.fields.contactName)) ?? null
    const contactEmail = asText(getPath(record, config.fields.contactEmail)) ?? null
    const contactPhone = asText(getPath(record, config.fields.contactPhone)) ?? null
    const now = new Date().toISOString()

    // Already linked from a previous sync, or an unlinked client with the same name.
    let existing = await db.prepare(`
      SELECT id, name, contact_name, contact_email, contact_phone, erp_client_id FROM clients WHERE erp_connection_id = ? AND erp_client_id = ?
    `).get(row.id, erpId) as ExistingClient | undefined
    if (!existing) {
      const sameNameId = unlinkedByName.get(normalizeName(name))
      if (sameNameId) {
        existing = await db.prepare(`
          SELECT id, name, contact_name, contact_email, contact_phone, erp_client_id FROM clients WHERE id = ?
        `).get(sameNameId) as ExistingClient | undefined
        unlinkedByName.delete(normalizeName(name))
      }
    }

    if (!existing) {
      const id = await nextClientId()
      await db.prepare(`
        INSERT INTO clients (id, name, contact_name, contact_email, contact_phone, stage, erp_connection_id, erp_client_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)
      `).run(id, name, contactName, contactEmail, contactPhone, row.id, erpId, now, now)
      result.created++
      continue
    }

    // The ERP owns only the mapped fields, and only when it actually has a value — stage, notes,
    // assignees and anything else edited in this app are never touched.
    const next = {
      name,
      contact_name: contactName ?? existing.contact_name,
      contact_email: contactEmail ?? existing.contact_email,
      contact_phone: contactPhone ?? existing.contact_phone,
    }
    const changed = next.name !== existing.name || next.contact_name !== existing.contact_name
      || next.contact_email !== existing.contact_email || next.contact_phone !== existing.contact_phone

    if (!changed && existing.erp_client_id)
      continue

    await db.prepare(`
      UPDATE clients
      SET name = ?, contact_name = ?, contact_email = ?, contact_phone = ?, erp_connection_id = ?, erp_client_id = ?, updated_at = ?
      WHERE id = ?
    `).run(next.name, next.contact_name, next.contact_email, next.contact_phone, row.id, erpId, now, existing.id)
    result.updated++
  }

  return result
}

interface ExistingProject {
  id: string
  client_id: string
  name: string
  description: string | null
  status: string
  start_date: string | null
  end_date: string | null
  erp_project_id: string | null
}

async function syncProjects(row: ErpConnectionRow, config: ErpSyncResourceConfig<ErpProjectFieldMap>) {
  const db = useDatabase()
  const result = emptyResult()
  const records = await fetchAllRecords(row, config)
  result.fetched = records.length

  for (const record of records) {
    const erpId = asText(getPath(record, config.idField))
    const name = asText(getPath(record, config.fields.name))
    const erpCustomerId = asText(getPath(record, config.fields.customerId))
    if (!erpId || !name) {
      skip(result, `Project skipped: missing ${!erpId ? `id ("${config.idField}")` : `name ("${config.fields.name}")`}`)
      continue
    }
    if (!erpCustomerId) {
      skip(result, `Project "${name}" skipped: no customer id at "${config.fields.customerId}"`)
      continue
    }

    const client = await db.prepare('SELECT id FROM clients WHERE erp_connection_id = ? AND erp_client_id = ?')
      .get(row.id, erpCustomerId) as { id: string } | undefined
    if (!client) {
      skip(result, `Project "${name}" skipped: its customer (${erpCustomerId}) hasn't been synced — enable customer sync or check the customer id field`)
      continue
    }

    const description = asText(getPath(record, config.fields.description)) ?? null
    const rawStatus = asText(getPath(record, config.fields.status))?.toLowerCase().replace(/[\s-]+/g, '_')
    const status = rawStatus && PROJECT_STATUSES.includes(rawStatus) ? rawStatus : undefined
    const startDate = asDate(getPath(record, config.fields.startDate)) ?? null
    const endDate = asDate(getPath(record, config.fields.endDate)) ?? null
    const now = new Date().toISOString()

    const existing = (await db.prepare(`
      SELECT id, client_id, name, description, status, start_date, end_date, erp_project_id FROM projects WHERE erp_connection_id = ? AND erp_project_id = ?
    `).get(row.id, erpId) ?? await db.prepare(`
      SELECT id, client_id, name, description, status, start_date, end_date, erp_project_id FROM projects WHERE erp_project_id IS NULL AND client_id = ? AND LOWER(name) = LOWER(?) LIMIT 1
    `).get(client.id, name)) as ExistingProject | undefined

    if (!existing) {
      const id = await nextProjectId()
      await db.prepare(`
        INSERT INTO projects (id, client_id, name, description, status, start_date, end_date, erp_connection_id, erp_project_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, client.id, name, description, status ?? 'planned', startDate, endDate, row.id, erpId, now, now)
      result.created++
      continue
    }

    const next = {
      client_id: client.id,
      name,
      description: description ?? existing.description,
      status: status ?? existing.status,
      start_date: startDate ?? existing.start_date,
      end_date: endDate ?? existing.end_date,
    }
    const changed = (Object.keys(next) as (keyof typeof next)[]).some(key => next[key] !== existing[key])

    if (!changed && existing.erp_project_id)
      continue

    await db.prepare(`
      UPDATE projects
      SET client_id = ?, name = ?, description = ?, status = ?, start_date = ?, end_date = ?, erp_connection_id = ?, erp_project_id = ?, updated_at = ?
      WHERE id = ?
    `).run(next.client_id, next.name, next.description, next.status, next.start_date, next.end_date, row.id, erpId, now, existing.id)
    result.updated++
  }

  return result
}

/**
 * Pulls every enabled resource for one connection into this app's own tables — customers into
 * Clients first, then projects into Projects (linked to the client synced from the same ERP
 * customer). Records are matched by the ERP's own id, so reruns update instead of duplicating.
 */
export async function runErpSync(row: ErpConnectionRow): Promise<ErpSyncSummary> {
  const db = useDatabase()
  const config = parseSyncConfig(row.sync_config)
  const summary: ErpSyncSummary = { startedAt: new Date().toISOString(), finishedAt: '' }
  let failed = false

  if (config.customers.enabled) {
    try {
      summary.customers = await syncCustomers(row, config.customers)
    }
    catch (error: any) {
      failed = true
      summary.customers = { ...emptyResult(), errors: [error?.message ?? 'Customer sync failed'] }
    }
  }

  if (config.projects.enabled) {
    try {
      summary.projects = await syncProjects(row, config.projects)
    }
    catch (error: any) {
      failed = true
      summary.projects = { ...emptyResult(), errors: [error?.message ?? 'Project sync failed'] }
    }
  }

  summary.finishedAt = new Date().toISOString()
  const hasSkips = !!(summary.customers?.skipped || summary.projects?.skipped)
  const status = failed ? 'error' : hasSkips ? 'partial' : 'ok'

  await db.prepare('UPDATE erp_connections SET last_synced_at = ?, last_sync_status = ?, last_sync_summary = ? WHERE id = ?')
    .run(summary.finishedAt, status, JSON.stringify(summary), row.id)

  return summary
}

/** Hourly entry point (cron route + in-process interval): syncs every connection that has at least one resource enabled. */
export async function runAllErpSyncs() {
  await ensureDb()
  const db = useDatabase()
  const rows = await db.prepare('SELECT * FROM erp_connections WHERE sync_config IS NOT NULL').all() as ErpConnectionRow[]

  const results: { connectionId: string, summary?: ErpSyncSummary, error?: string }[] = []
  for (const row of rows) {
    const config = parseSyncConfig(row.sync_config)
    if (!config.customers.enabled && !config.projects.enabled)
      continue
    try {
      results.push({ connectionId: row.id, summary: await runErpSync(row) })
    }
    catch (error: any) {
      console.error(`ERP sync failed for ${row.id}`, error)
      results.push({ connectionId: row.id, error: error?.message ?? 'Sync failed' })
    }
  }

  return { synced: results.length, results }
}
