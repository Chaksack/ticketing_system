/** Inbox actions: take the chat, hand it to a colleague, end it, or turn it into a ticket. */
export default defineEventHandler(async (event) => {
  const user = await requireServiceStaff(event)
  const id = getRouterParam(event, 'id') ?? ''
  const body = await readBody<{ action?: 'assign_me' | 'transfer' | 'close' | 'create_ticket', assigneeId?: string, priority?: 'low' | 'medium' | 'high' | 'urgent' }>(event)

  await ensureDb()
  const db = useTenantDb()
  const chat = await loadChatDetail(id)
  if (!chat)
    throw createError({ statusCode: 404, statusMessage: 'Chat not found' })

  switch (body?.action) {
    case 'assign_me':
      await db.prepare('UPDATE live_chats SET assignee_id = ?, assignee_name = ? WHERE id = ?').run(user.id, user.name, id)
      break
    case 'transfer': {
      const target = await db.prepare('SELECT id, name FROM staff WHERE id = ? AND status = \'active\'').get(body.assigneeId ?? '') as { id: string, name: string } | undefined
      if (!target)
        throw createError({ statusCode: 400, statusMessage: 'Pick an active colleague' })
      await db.prepare('UPDATE live_chats SET assignee_id = ?, assignee_name = ? WHERE id = ?').run(target.id, target.name, id)
      await addChatMessage(id, { authorType: 'system', authorName: 'System', body: `${user.name} transferred the chat to ${target.name}.` })
      if (target.id !== user.id)
        await createNotification({ staffId: target.id, type: 'live_chat', title: `${user.name} transferred a chat to you`, body: `${chat.visitorName}: ${chat.subject ?? ''}`.slice(0, 120), url: `/inbox?open=${id}` })
      break
    }
    case 'close':
      if (chat.status !== 'closed') {
        await addChatMessage(id, { authorType: 'system', authorName: 'System', body: `${user.name} ended the chat.` })
        await db.prepare('UPDATE live_chats SET status = \'closed\', closed_at = ? WHERE id = ?').run(new Date().toISOString(), id)
      }
      break
    case 'create_ticket':
      await createTicketFromChat(id, user, { priority: body.priority })
      break
    default:
      throw createError({ statusCode: 400, statusMessage: 'Unknown action' })
  }

  return { chat: await loadChatDetail(id) }
})
