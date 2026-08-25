import type { ClientRow } from '../../utils/mappers'

export default defineEventHandler(async (event) => {
  await requireBd(event)
  await ensureDb()

  const db = useDatabase()
  const rows = await db.prepare(`
    SELECT clients.*, staff.name AS assigned_to_name,
      (SELECT COUNT(*) FROM client_amc_contracts c WHERE c.client_id = clients.id AND c.status = 'active') AS active_contract_count
    FROM clients
    LEFT JOIN staff ON staff.id = clients.assigned_to
    ORDER BY clients.created_at DESC
  `).all() as (ClientRow & { active_contract_count: number | string })[]

  const clients = rows.map(row => ({
    ...mapClientRow(row),
    activeContractCount: Number(row.active_contract_count),
  }))

  return { clients }
})
