import type { VisitorChatView } from '../../../../../app/types/liveChat'
import type { LiveChatRow } from '../../../../utils/liveChat'

/** The AI started a reply and hasn't posted it yet. */
async function aiIsTyping(chat: LiveChatRow) {
  if (!chat.ai_thinking_at || Date.now() - new Date(chat.ai_thinking_at).getTime() > 90_000)
    return false
  const replied = await useTenantDb().prepare('SELECT 1 FROM live_chat_messages WHERE chat_id = ? AND author_type = \'ai\' AND created_at > ? LIMIT 1').get(chat.id, chat.ai_thinking_at)
  return !replied
}

/** The visitor's own chat, by its private token. `after` returns only newer messages (polling). */
export default defineEventHandler(async (event): Promise<VisitorChatView> => {
  await useWorkspaceFromRequest(event)
  await ensureDb()

  const token = getRouterParam(event, 'token') ?? ''
  const chat = await useTenantDb().prepare('SELECT * FROM live_chats WHERE token = ?').get(token) as LiveChatRow | undefined
  if (!chat)
    throw createError({ statusCode: 404, statusMessage: 'This chat was not found' })

  const after = getQuery(event).after
  const aiAgent = chat.status === 'ai' && chat.ai_agent_id ? await loadAiAgent(chat.ai_agent_id) : null
  return {
    status: chat.status,
    agentName: chat.assignee_name ?? undefined,
    aiAgentName: aiAgent?.name,
    typing: await aiIsTyping(chat),
    messages: await loadChatMessages(chat.id, typeof after === 'string' ? after : undefined, { visitor: true }),
  }
})
