import type { LeadRow } from '../../utils/mappers'

export default defineEventHandler(async (event) => {
  const user = await requireBd(event)
  await ensureDb()

  const query = getQuery(event)
  const db = useDatabase()

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

  return { leads: rows.map(row => mapLeadRow(row, [], assigneesByLead.get(row.id) ?? [])) }
})
