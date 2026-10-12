import type { VisitorChatView } from '../../../../../app/types/liveChat'
import type { LiveChatRow } from '../../../../utils/liveChat'

/** The visitor's own chat, by its private token. `after` returns only newer messages (polling). */
export default defineEventHandler(async (event): Promise<VisitorChatView> => {
  await useWorkspaceFromRequest(event)
  await ensureDb()

  const token = getRouterParam(event, 'token') ?? ''
  const chat = await useTenantDb().prepare('SELECT * FROM live_chats WHERE token = ?').get(token) as LiveChatRow | undefined
  if (!chat)
    throw createError({ statusCode: 404, statusMessage: 'This chat was not found' })

  const after = getQuery(event).after
  return {
    status: chat.status,
    agentName: chat.assignee_name ?? undefined,
    messages: await loadChatMessages(chat.id, typeof after === 'string' ? after : undefined),
  }
})
