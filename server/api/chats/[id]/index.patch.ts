/** Inbox actions: take the chat (from the AI too), hand it to a colleague or back to the AI, end it, or turn it into a ticket. */
export default defineEventHandler(async (event) => {
  const user = await requireServiceStaff(event)
  const id = getRouterParam(event, 'id') ?? ''
  const body = await readBody<{ action?: 'assign_me' | 'transfer' | 'close' | 'create_ticket' | 'return_to_ai', assigneeId?: string, priority?: 'low' | 'medium' | 'high' | 'urgent' }>(event)

  await ensureDb()
  const db = useTenantDb()
  const chat = await loadChatDetail(id)
  if (!chat)
    throw createError({ statusCode: 404, statusMessage: 'Chat not found' })

  switch (body?.action) {
    case 'assign_me':
      // Taking an AI chat stops the AI and tells the customer a person has joined.
      if (chat.status === 'ai')
        await addChatMessage(id, { authorType: 'system', authorName: 'System', body: `${user.name} joined the chat.` })
      await db.prepare(`UPDATE live_chats SET assignee_id = ?, assignee_name = ?, status = CASE WHEN status = 'ai' THEN 'active' ELSE status END, ai_thinking_at = NULL WHERE id = ?`).run(user.id, user.name, id)
      break
    case 'return_to_ai': {
      if (chat.status === 'closed')
        throw createError({ statusCode: 409, statusMessage: 'This chat has ended' })
      const agent = (chat.aiAgentId ? await loadAiAgent(chat.aiAgentId) : null) ?? (await listAiAgents()).find(a => a.enabled && a.serviceMode !== 'human_only')
      if (!agent?.enabled)
        throw createError({ statusCode: 400, statusMessage: 'No AI agent is switched on. Set one up in AI agents.' })
      await db.prepare('UPDATE live_chats SET status = \'ai\', ai_agent_id = ?, assignee_id = NULL, assignee_name = NULL, handoff_reason = NULL, handed_off_at = NULL WHERE id = ?').run(agent.id, id)
      await addChatMessage(id, { authorType: 'system', authorName: 'System', body: `${user.name} passed the chat back to ${agent.name} (AI).` })
      break
    }
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
