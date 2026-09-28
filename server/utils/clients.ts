import type { Client, ClientActivityType } from '../../app/types/client'
import type { ClientActivityRow, ClientContactEmailRow, ClientContactPhoneRow, ClientContactRow, ClientDocumentRow, ClientRow, ContractRow, ProjectRow } from './mappers'
import { del } from '@vercel/blob'
import { deleteProjectCascade, PROJECT_TOTALS_COLUMNS } from './projects'

const CLIENT_SELECT = 'SELECT * FROM clients WHERE id = ?'

export async function loadFullClient(id: string): Promise<Client> {
  const db = useDatabase()

  const row = await db.prepare(CLIENT_SELECT).get(id) as ClientRow | undefined
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Client not found' })
  }

  const activityRows = await db.prepare('SELECT * FROM client_activity WHERE client_id = ? ORDER BY created_at ASC').all(id) as ClientActivityRow[]

  // Legacy contracts predate Projects and were never linked to one — still surfaced at the
  // client level so nothing already assigned silently disappears from view.
  const legacyContractRows = await db.prepare(`
    SELECT client_amc_contracts.*, amc_plans.name AS plan_name, amc_plans.price AS plan_price
    FROM client_amc_contracts
    LEFT JOIN amc_plans ON amc_plans.id = client_amc_contracts.plan_id
    WHERE client_amc_contracts.client_id = ? AND client_amc_contracts.project_id IS NULL
    ORDER BY client_amc_contracts.start_date DESC
  `).all(id) as ContractRow[]

  const projectRows = await db.prepare(`
    SELECT projects.*, clients.name AS client_name, ${PROJECT_TOTALS_COLUMNS}
    FROM projects
    LEFT JOIN clients ON clients.id = projects.client_id
    WHERE projects.client_id = ?
    ORDER BY projects.created_at DESC
  `).all(id) as ProjectRow[]

  const projects = []
  for (const projectRow of projectRows) {
    const contractRows = await db.prepare(`
      SELECT client_amc_contracts.*, amc_plans.name AS plan_name, amc_plans.price AS plan_price
      FROM client_amc_contracts
      LEFT JOIN amc_plans ON amc_plans.id = client_amc_contracts.plan_id
      WHERE client_amc_contracts.project_id = ?
      ORDER BY client_amc_contracts.start_date DESC
    `).all(projectRow.id) as ContractRow[]

    const contracts = []
    for (const contractRow of contractRows) {
      const lineItems = await getContractLineItems(contractRow.id)
      contracts.push(mapContractRow(contractRow, lineItems))
    }
    projects.push(mapProjectRow(projectRow, contracts))
  }

  const emailRows = await db.prepare('SELECT * FROM client_contact_emails WHERE client_id = ? ORDER BY created_at ASC').all(id) as ClientContactEmailRow[]
  const phoneRows = await db.prepare('SELECT * FROM client_contact_phones WHERE client_id = ? ORDER BY created_at ASC').all(id) as ClientContactPhoneRow[]
  const contactRows = await db.prepare('SELECT * FROM client_contacts WHERE client_id = ? ORDER BY is_primary DESC, created_at ASC').all(id) as ClientContactRow[]
  const assignees = await getClientAssignees(id)
  const documentRows = await db.prepare('SELECT * FROM client_documents WHERE client_id = ? ORDER BY created_at ASC').all(id) as ClientDocumentRow[]
  const interactions = await getInteractions('client', id)

  const legacyContracts = []
  for (const contractRow of legacyContractRows) {
    const lineItems = await getContractLineItems(contractRow.id)
    legacyContracts.push(mapContractRow(contractRow, lineItems))
  }

  return mapClientRow(
    row,
    activityRows.map(activityRow => mapClientActivityRow(activityRow)),
    legacyContracts,
    projects,
    emailRows.map(emailRow => mapClientContactEmailRow(emailRow)),
    phoneRows.map(phoneRow => mapClientContactPhoneRow(phoneRow)),
    assignees,
    contactRows.map(contactRow => mapClientContactRow(contactRow)),
    documentRows.map(documentRow => mapClientDocumentRow(documentRow)),
    interactions,
  )
}

export async function logClientActivity(options: {
  clientId: string
  type: ClientActivityType
  actorId?: string
  actorName?: string
  fromValue?: string
  toValue?: string
  message?: string
}) {
  const db = useDatabase()
  const id = await nextClientActivityId()
  const now = new Date().toISOString()

  await db.prepare(`
    INSERT INTO client_activity (id, client_id, type, actor_id, actor_name, from_value, to_value, message, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, options.clientId, options.type, options.actorId ?? null, options.actorName ?? null, options.fromValue ?? null, options.toValue ?? null, options.message ?? null, now)
}

export async function touchClient(clientId: string) {
  const db = useDatabase()
  await db.prepare('UPDATE clients SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), clientId)
}

/**
 * Permanently deletes a client and everything that belongs only to it: contacts, documents (and
 * their stored files), AMC contracts, quotes/orders raised for it, interactions, activity, and its
 * projects (see deleteProjectCascade). Records that stand on their own — tasks, calendar events,
 * and the lead/tender it was converted from — are kept and just unlinked.
 */
export async function deleteClientCascade(id: string) {
  const db = useDatabase()

  const projectRows = await db.prepare('SELECT id FROM projects WHERE client_id = ?').all(id) as { id: string }[]
  for (const project of projectRows)
    await deleteProjectCascade(project.id)

  const contractRows = await db.prepare('SELECT id FROM client_amc_contracts WHERE client_id = ?').all(id) as { id: string }[]
  for (const contract of contractRows)
    await db.prepare('DELETE FROM contract_line_items WHERE contract_id = ?').run(contract.id)
  await db.prepare('DELETE FROM client_amc_contracts WHERE client_id = ?').run(id)

  const quoteRows = await db.prepare(`SELECT id FROM quotes WHERE regarding_type = 'client' AND regarding_id = ?`).all(id) as { id: string }[]
  for (const quote of quoteRows)
    await db.prepare('DELETE FROM quote_line_items WHERE quote_id = ?').run(quote.id)
  await db.prepare(`DELETE FROM quotes WHERE regarding_type = 'client' AND regarding_id = ?`).run(id)
  const orderRows = await db.prepare(`SELECT id FROM sales_orders WHERE regarding_type = 'client' AND regarding_id = ?`).all(id) as { id: string }[]
  for (const order of orderRows)
    await db.prepare('DELETE FROM sales_order_line_items WHERE order_id = ?').run(order.id)
  await db.prepare(`DELETE FROM sales_orders WHERE regarding_type = 'client' AND regarding_id = ?`).run(id)

  // Stored files first — best-effort, a missing blob shouldn't block deleting the client.
  const documentRows = await db.prepare('SELECT url FROM client_documents WHERE client_id = ?').all(id) as { url: string }[]
  for (const document of documentRows)
    await del(document.url).catch(() => {})
  await db.prepare('DELETE FROM client_documents WHERE client_id = ?').run(id)

  await db.prepare(`DELETE FROM interactions WHERE regarding_type = 'client' AND regarding_id = ?`).run(id)
  await db.prepare(`UPDATE calendar_events SET regarding_type = NULL, regarding_id = NULL WHERE regarding_type = 'client' AND regarding_id = ?`).run(id)
  await db.prepare('UPDATE leads SET converted_client_id = NULL WHERE converted_client_id = ?').run(id)
  await db.prepare('UPDATE tenders SET converted_client_id = NULL WHERE converted_client_id = ?').run(id)

  await db.prepare('DELETE FROM client_activity WHERE client_id = ?').run(id)
  await db.prepare('DELETE FROM client_assignees WHERE client_id = ?').run(id)
  await db.prepare('DELETE FROM client_contact_emails WHERE client_id = ?').run(id)
  await db.prepare('DELETE FROM client_contact_phones WHERE client_id = ?').run(id)
  await db.prepare('DELETE FROM client_contacts WHERE client_id = ?').run(id)
  await db.prepare('DELETE FROM clients WHERE id = ?').run(id)
}
