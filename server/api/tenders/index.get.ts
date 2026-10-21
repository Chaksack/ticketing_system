import type { TenderRow } from '../../utils/mappers'

export default defineEventHandler(async (event) => {
  const user = await requireBd(event)
  await ensureDb()

  const query = getQuery(event)
  const db = useTenantDb()

  let rows: TenderRow[]
  if (query.scope === 'team') {
    const teamStaffIds = await getTeamStaffIds(user.id)
    rows = await db.prepare(`
      SELECT DISTINCT tenders.*
      FROM tenders
      JOIN tender_assignees ON tender_assignees.tender_id = tenders.id
      WHERE tender_assignees.staff_id = ANY(?)
      ORDER BY tenders.created_at DESC
    `).all(teamStaffIds as any) as TenderRow[]
  }
  else {
    rows = await db.prepare('SELECT * FROM tenders ORDER BY created_at DESC').all() as TenderRow[]
  }

  const assigneesByTender = await getAllTenderAssignees()

  // When each record last changed stage, for "days in stage" on the pipeline board.
  const moves = await db.prepare('SELECT tender_id AS id, MAX(created_at) AS at FROM tender_activity WHERE type = \'stage_changed\' GROUP BY tender_id').all() as { id: string, at: string }[]
  const movedAt = new Map(moves.map(m => [m.id, m.at]))

  return { tenders: rows.map(row => ({ ...mapTenderRow(row, [], assigneesByTender.get(row.id) ?? []), stageChangedAt: movedAt.get(row.id) ?? row.created_at })) }
})
