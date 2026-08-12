import type { ReplyRow, TicketRow } from '../../../utils/mappers'

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)

  const id = getRouterParam(event, 'id')
  const body = await readBody<{ message?: string }>(event)

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing ticket id' })
  }

  if (!body?.message?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Reply message is required' })
  }

  await ensureDb()
  const db = useDatabase()

  const ticket = await db.prepare('SELECT * FROM tickets WHERE id = ?').get(id) as TicketRow | undefined
  if (!ticket) {
    throw createError({ statusCode: 404, statusMessage: 'Ticket not found' })
  }

  const replyId = await nextReplyId()
  const now = new Date().toISOString()

  await db.prepare(`
    INSERT INTO ticket_replies (id, ticket_id, author, message, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(replyId, id, user.name, body.message.trim(), now)

  const replyRows = await db.prepare('SELECT * FROM ticket_replies WHERE ticket_id = ? ORDER BY created_at ASC').all(id) as ReplyRow[]

  return { ticket: mapTicketRow(ticket, replyRows.map(row => mapReplyRow(row))) }
})
