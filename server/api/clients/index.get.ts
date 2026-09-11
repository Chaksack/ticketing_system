import type { ClientRow } from '../../utils/mappers'

export default defineEventHandler(async (event) => {
  const user = await requireBd(event)
  await ensureDb()

  const query = getQuery(event)
  const db = useDatabase()

  let rows: (ClientRow & { active_contract_count: number | string })[]
  if (query.scope === 'team') {
    const teamStaffIds = await getTeamStaffIds(user.id)
    rows = await db.prepare(`
      SELECT DISTINCT clients.*,
        (SELECT COUNT(*) FROM client_amc_contracts c WHERE c.client_id = clients.id AND c.status = 'active') AS active_contract_count
      FROM clients
      JOIN client_assignees ON client_assignees.client_id = clients.id
      WHERE client_assignees.staff_id = ANY(?)
      ORDER BY clients.created_at DESC
    `).all(teamStaffIds as any) as (ClientRow & { active_contract_count: number | string })[]
  }
  else {
    rows = await db.prepare(`
      SELECT clients.*,
        (SELECT COUNT(*) FROM client_amc_contracts c WHERE c.client_id = clients.id AND c.status = 'active') AS active_contract_count
      FROM clients
      ORDER BY clients.created_at DESC
    `).all() as (ClientRow & { active_contract_count: number | string })[]
  }

  const assigneesByClient = await getAllClientAssignees()

  const clients = rows.map(row => ({
    ...mapClientRow(row, [], [], [], [], [], assigneesByClient.get(row.id) ?? []),
    activeContractCount: Number(row.active_contract_count),
  }))

  return { clients }
})
