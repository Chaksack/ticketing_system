import type { H3Event } from 'h3'
import { createHash, randomBytes } from 'node:crypto'

export interface ApiKeyRow {
  id: string
  label: string
  key_prefix: string
  key_hash: string
  scopes: string
  created_by: string | null
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

/**
 * A key is shown once, at creation — only its hash is ever stored, same reasoning as a password.
 * Shaped `erp_<company>_<secret>` so an export request can find the right company's database;
 * keys issued before multi-company support (`erp_<secret>`) belong to the home workspace.
 */
export function generateApiKey(orgId = currentOrgId()): { key: string, prefix: string, hash: string } {
  const secret = randomBytes(32).toString('hex')
  const key = `erp_${orgId}_${secret}`
  return { key, prefix: `erp_${orgId}_${secret.slice(0, 6)}`, hash: hashKey(key) }
}

function orgIdFromApiKey(key: string): string | null {
  const match = /^erp_([a-z0-9][a-z0-9-]{1,40})_[0-9a-f]{64}$/.exec(key)
  if (match)
    return match[1]!
  return /^erp_[0-9a-f]{64}$/.test(key) ? HOME_ORG_ID : null
}

/**
 * The per-key equivalent of requireCronAuth's single shared-secret check (server/utils/cron.ts) —
 * same Bearer-header shape, a DB lookup instead of one static comparison. Never accepts a
 * session cookie; this is exclusively for machine-to-machine callers (the ERP export API).
 * With no `resource` given, any valid, non-revoked key passes — used by the self-discovery
 * endpoint, which reflects back only the scopes the presented key actually has.
 */
export async function requireApiKey(event: H3Event, resource?: string): Promise<ApiKeyRow> {
  const header = getHeader(event, 'authorization')
  const presented = header?.startsWith('Bearer ') ? header.slice(7).trim() : undefined

  if (!presented) {
    throw createError({ statusCode: 401, statusMessage: 'Missing Authorization: Bearer <api key> header' })
  }

  const orgId = orgIdFromApiKey(presented)
  const org = orgId ? await getOrganization(orgId) : null
  if (!org || org.status !== 'active') {
    throw createError({ statusCode: 401, statusMessage: 'Invalid or revoked API key' })
  }
  setRequestOrg(event, org.id)

  await ensureDb()
  const db = useTenantDb()

  const row = await db.prepare('SELECT * FROM api_keys WHERE key_hash = ?').get(hashKey(presented)) as ApiKeyRow | undefined
  if (!row || row.revoked_at) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid or revoked API key' })
  }

  if (resource) {
    const scopes = JSON.parse(row.scopes) as string[]
    if (!scopes.includes(resource)) {
      throw createError({ statusCode: 403, statusMessage: `This key does not have access to "${resource}"` })
    }
  }

  await db.prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?').run(new Date().toISOString(), row.id)

  return row
}
