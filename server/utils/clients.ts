import type { Client, ClientActivityType } from '../../app/types/client'
import type { ClientActivityRow, ClientContactEmailRow, ClientContactPhoneRow, ClientRow, ContractRow, ProjectRow } from './mappers'

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
    SELECT client_amc_contracts.*, amc_plans.name AS plan_name
    FROM client_amc_contracts
    LEFT JOIN amc_plans ON amc_plans.id = client_amc_contracts.plan_id
    WHERE client_amc_contracts.client_id = ? AND client_amc_contracts.project_id IS NULL
    ORDER BY client_amc_contracts.start_date DESC
  `).all(id) as ContractRow[]

  const projectRows = await db.prepare(`
    SELECT projects.*, clients.name AS client_name
    FROM projects
    LEFT JOIN clients ON clients.id = projects.client_id
    WHERE projects.client_id = ?
    ORDER BY projects.created_at DESC
  `).all(id) as ProjectRow[]

  const projects = []
  for (const projectRow of projectRows) {
    const contractRows = await db.prepare(`
      SELECT client_amc_contracts.*, amc_plans.name AS plan_name
      FROM client_amc_contracts
      LEFT JOIN amc_plans ON amc_plans.id = client_amc_contracts.plan_id
      WHERE client_amc_contracts.project_id = ?
      ORDER BY client_amc_contracts.start_date DESC
    `).all(projectRow.id) as ContractRow[]
    projects.push(mapProjectRow(projectRow, contractRows.map(contractRow => mapContractRow(contractRow))))
  }

  const emailRows = await db.prepare('SELECT * FROM client_contact_emails WHERE client_id = ? ORDER BY created_at ASC').all(id) as ClientContactEmailRow[]
  const phoneRows = await db.prepare('SELECT * FROM client_contact_phones WHERE client_id = ? ORDER BY created_at ASC').all(id) as ClientContactPhoneRow[]
  const assignees = await getClientAssignees(id)

  return mapClientRow(
    row,
    activityRows.map(activityRow => mapClientActivityRow(activityRow)),
    legacyContractRows.map(contractRow => mapContractRow(contractRow)),
    projects,
    emailRows.map(emailRow => mapClientContactEmailRow(emailRow)),
    phoneRows.map(phoneRow => mapClientContactPhoneRow(phoneRow)),
    assignees,
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
