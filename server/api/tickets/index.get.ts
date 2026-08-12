import type { TicketRow } from '../../utils/mappers'

export default defineEventHandler(async (event) => {
  await requireSessionUser(event)
  await ensureDb()

  const db = useDatabase()
  const rows = await db.prepare('SELECT * FROM tickets ORDER BY created_at DESC').all() as TicketRow[]

  return { tickets: rows.map(row => mapTicketRow(row)) }
})
