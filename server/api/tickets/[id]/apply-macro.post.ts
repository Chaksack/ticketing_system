import type { MacroRow, TicketRow } from '../../../utils/mappers'

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)

  const id = getRouterParam(event, 'id')
  const body = await readBody<{ macroId?: string }>(event)

  if (!id || !body?.macroId) {
    throw createError({ statusCode: 400, statusMessage: 'ticket id and macroId are required' })
  }

  await ensureDb()
  const db = useDatabase()

  const ticket = await db.prepare('SELECT * FROM tickets WHERE id = ?').get(id) as TicketRow | undefined
  if (!ticket) {
    throw createError({ statusCode: 404, statusMessage: 'Ticket not found' })
  }

  const macro = await db.prepare('SELECT * FROM macros WHERE id = ?').get(body.macroId) as MacroRow | undefined
  if (!macro) {
    throw createError({ statusCode: 404, statusMessage: 'Macro not found' })
  }

  const replyId = await nextReplyId()
  const now = new Date().toISOString()

  await db.prepare(`
    INSERT INTO ticket_replies (id, ticket_id, author, message, created_at, internal, author_id, author_type)
    VALUES (?, ?, ?, ?, ?, 0, ?, 'staff')
  `).run(replyId, id, user.name, macro.body, now, user.id)

  if (!ticket.first_response_at) {
    await db.prepare('UPDATE tickets SET first_response_at = ? WHERE id = ?').run(now, id)
  }

  try {
    await sendTicketReplyEmail({
      to: ticket.requester_email,
      name: ticket.requester,
      ticketId: id,
      subject: ticket.subject,
      message: macro.body,
    })
  }
  catch (error) {
    console.error('Failed to send ticket reply email', error)
  }

  const status = macro.set_status ?? ticket.status
  const priority = macro.set_priority ?? ticket.priority

  await db.prepare('UPDATE tickets SET status = ?, priority = ?, updated_at = ? WHERE id = ?').run(status, priority, now, id)

  if (macro.add_tag_id) {
    await db.prepare('INSERT INTO ticket_tags (ticket_id, tag_id) VALUES (?, ?) ON CONFLICT DO NOTHING').run(id, macro.add_tag_id)
  }

  await logTicketActivity({
    ticketId: id,
    type: 'macro_applied',
    actorId: user.id,
    actorName: user.name,
    message: `Macro "${macro.name}" applied`,
  })

  const updated = await loadFullTicket(id)
  return { ticket: updated }
})
