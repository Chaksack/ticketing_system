import type { LeadRow } from '../../utils/mappers'

export default defineEventHandler(async (event) => {
  await requireBd(event)
  await ensureDb()

  const db = useDatabase()
  const rows = await db.prepare(`
    SELECT * FROM leads ORDER BY created_at DESC
  `).all() as LeadRow[]

  const assigneesByLead = await getAllLeadAssignees()

  return { leads: rows.map(row => mapLeadRow(row, [], assigneesByLead.get(row.id) ?? [])) }
})
