import type { LeadRow } from '../../utils/mappers'

export default defineEventHandler(async (event) => {
  await requireBd(event)
  await ensureDb()

  const db = useDatabase()
  const rows = await db.prepare(`
    SELECT leads.*, staff.name AS assigned_to_name
    FROM leads
    LEFT JOIN staff ON staff.id = leads.assigned_to
    ORDER BY leads.created_at DESC
  `).all() as LeadRow[]

  return { leads: rows.map(row => mapLeadRow(row)) }
})
