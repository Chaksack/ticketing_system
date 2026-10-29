import type { LiveChatRow } from '../../../../utils/liveChat'

const MESSAGES_PER_CHAT_PER_HOUR = 120
const HOUR_MS = 60 * 60 * 1000

/** The visitor sends a message, or ends the chat (`{ action: 'end' }`). */
export default defineEventHandler(async (event) => {
  applyPortalCors(event)
  await useWorkspaceFromRequest(event)
  await ensureDb()

  const token = getRouterParam(event, 'token') ?? ''
  const db = useTenantDb()
  const chat = await db.prepare('SELECT * FROM live_chats WHERE token = ?').get(token) as LiveChatRow | undefined
  if (!chat)
    throw createError({ statusCode: 404, statusMessage: 'This chat was not found' })
  if (chat.status === 'closed')
    throw createError({ statusCode: 409, statusMessage: 'This chat has ended' })

  const body = await readBody<{ message?: string, action?: 'end' | 'human' }>(event)
  // "Talk to a person" in the widget.
  if (body?.action === 'human') {
    if (chat.status === 'ai')
      await handOffChat(chat.id, chat.ai_agent_id ? await loadAiAgent(chat.ai_agent_id) : null, 'the customer asked for a person')
    return { ok: true }
  }
  if (body?.action === 'end') {
    await addChatMessage(chat.id, { authorType: 'system', authorName: 'System', body: `${chat.visitor_name} ended the chat.` })
    await db.prepare('UPDATE live_chats SET status = \'closed\', closed_at = ? WHERE id = ?').run(new Date().toISOString(), chat.id)
    return { ok: true }
  }

  const message = body?.message?.trim().slice(0, 4000)
  if (!message)
    throw createError({ statusCode: 400, statusMessage: 'Message is empty' })
  if (!(await checkRateLimit('live-chat-message', chat.id, MESSAGES_PER_CHAT_PER_HOUR, HOUR_MS)).allowed)
    throw createError({ statusCode: 429, statusMessage: 'You are sending messages too quickly.' })

  await addChatMessage(chat.id, { authorType: 'visitor', authorName: chat.visitor_name, body: message })
  if (chat.status === 'ai')
    scheduleAgentTurn(event, chat.id)
  return { ok: true }
})
