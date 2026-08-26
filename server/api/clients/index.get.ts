import type { ClientRow } from '../../utils/mappers'

export default defineEventHandler(async (event) => {
  await requireBd(event)
  await ensureDb()

  const db = useDatabase()
  const rows = await db.prepare(`
    SELECT clients.*,
      (SELECT COUNT(*) FROM client_amc_contracts c WHERE c.client_id = clients.id AND c.status = 'active') AS active_contract_count
    FROM clients
    ORDER BY clients.created_at DESC
  `).all() as (ClientRow & { active_contract_count: number | string })[]

  const assigneesByClient = await getAllClientAssignees()

  const clients = rows.map(row => ({
    ...mapClientRow(row, [], [], [], [], [], assigneesByClient.get(row.id) ?? []),
    activeContractCount: Number(row.active_contract_count),
  }))

  return { clients }
})
