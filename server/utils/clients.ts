import type { Client, ClientActivityType } from '../../app/types/client'
import type { ClientActivityRow, ClientRow, ContractRow } from './mappers'

const CLIENT_SELECT = `
  SELECT clients.*, staff.name AS assigned_to_name
  FROM clients
  LEFT JOIN staff ON staff.id = clients.assigned_to
  WHERE clients.id = ?
`

export async function loadFullClient(id: string): Promise<Client> {
  const db = useDatabase()

  const row = await db.prepare(CLIENT_SELECT).get(id) as ClientRow | undefined
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Client not found' })
  }

  const activityRows = await db.prepare('SELECT * FROM client_activity WHERE client_id = ? ORDER BY created_at ASC').all(id) as ClientActivityRow[]
  const contractRows = await db.prepare(`
    SELECT client_amc_contracts.*, amc_plans.name AS plan_name
    FROM client_amc_contracts
    LEFT JOIN amc_plans ON amc_plans.id = client_amc_contracts.plan_id
    WHERE client_amc_contracts.client_id = ?
    ORDER BY client_amc_contracts.start_date DESC
  `).all(id) as ContractRow[]

  return mapClientRow(
    row,
    activityRows.map(activityRow => mapClientActivityRow(activityRow)),
    contractRows.map(contractRow => mapContractRow(contractRow)),
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
