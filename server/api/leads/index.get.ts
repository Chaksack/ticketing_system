import type { LeadRow } from '../../utils/mappers'

export default defineEventHandler(async (event) => {
  const user = await requireBd(event)
  await ensureDb()

  const query = getQuery(event)
  const db = useTenantDb()

  let rows: LeadRow[]
  if (query.scope === 'team') {
    const teamStaffIds = await getTeamStaffIds(user.id)
    rows = await db.prepare(`
      SELECT DISTINCT leads.*
      FROM leads
      JOIN lead_assignees ON lead_assignees.lead_id = leads.id
      WHERE lead_assignees.staff_id = ANY(?)
      ORDER BY leads.created_at DESC
    `).all(teamStaffIds as any) as LeadRow[]
  }
  else {
    rows = await db.prepare('SELECT * FROM leads ORDER BY created_at DESC').all() as LeadRow[]
  }

  const assigneesByLead = await getAllLeadAssignees()

  // When each record last changed stage, for "days in stage" on the pipeline board.
  const moves = await db.prepare('SELECT lead_id AS id, MAX(created_at) AS at FROM lead_activity WHERE type = \'stage_changed\' GROUP BY lead_id').all() as { id: string, at: string }[]
  const movedAt = new Map(moves.map(m => [m.id, m.at]))

  return { leads: rows.map(row => ({ ...mapLeadRow(row, [], assigneesByLead.get(row.id) ?? []), stageChangedAt: movedAt.get(row.id) ?? row.created_at })) }
})
