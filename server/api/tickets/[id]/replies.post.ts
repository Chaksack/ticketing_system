import type { TicketRow } from '../../../utils/mappers'

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)

  const id = getRouterParam(event, 'id')
  const body = await readBody<{ message?: string, internal?: boolean }>(event)

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing ticket id' })
  }

  if (!body?.message?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Reply message is required' })
  }

  const internal = !!body.internal

  await ensureDb()
  const db = useDatabase()

  const ticket = await db.prepare('SELECT * FROM tickets WHERE id = ?').get(id) as TicketRow | undefined
  if (!ticket) {
    throw createError({ statusCode: 404, statusMessage: 'Ticket not found' })
  }

  const replyId = await nextReplyId()
  const now = new Date().toISOString()
  const message = body.message.trim()

  await db.prepare(`
    INSERT INTO ticket_replies (id, ticket_id, author, message, created_at, internal, author_id, author_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'staff')
  `).run(replyId, id, user.name, message, now, internal ? 1 : 0, user.id)

  if (!internal) {
    if (!ticket.first_response_at) {
      await db.prepare('UPDATE tickets SET first_response_at = ?, updated_at = ? WHERE id = ?').run(now, now, id)
    }
    else {
      await touchTicket(id)
    }

    try {
      await sendTicketReplyEmail({
        to: ticket.requester_email,
        name: ticket.requester,
        ticketId: id,
        subject: ticket.subject,
        message,
      })
    }
    catch (error) {
      console.error('Failed to send ticket reply email', error)
    }
  }
  else {
    await touchTicket(id)
  }

  const updated = await loadFullTicket(id)
  return { ticket: updated }
})
