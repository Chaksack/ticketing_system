import type { PageRow } from '../../../utils/mappers'

export default defineEventHandler(async (event) => {
  await requireSessionUser(event)
  await ensureDb()

  const db = useDatabase()
  const rows = await db.prepare('SELECT * FROM pages ORDER BY created_at DESC LIMIT 20').all() as PageRow[]

  return {
    pages: rows.map(row => ({
      id: row.id,
      ticketId: row.ticket_id,
      ticketSubject: row.ticket_subject,
      staffId: row.staff_id,
      staffName: row.staff_name,
      createdAt: row.created_at,
      acknowledged: !!row.acknowledged,
    })),
  }
})
