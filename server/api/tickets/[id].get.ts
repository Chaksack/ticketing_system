import type { ReplyRow, TicketRow } from '../../utils/mappers'

export default defineEventHandler(async (event) => {
  await requireSessionUser(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing ticket id' })
  }

  await ensureDb()
  const db = useDatabase()

  const row = await db.prepare('SELECT * FROM tickets WHERE id = ?').get(id) as TicketRow | undefined
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Ticket not found' })
  }

  const replyRows = await db.prepare('SELECT * FROM ticket_replies WHERE ticket_id = ? ORDER BY created_at ASC').all(id) as ReplyRow[]

  return { ticket: mapTicketRow(row, replyRows.map(mapReplyRow)) }
})
