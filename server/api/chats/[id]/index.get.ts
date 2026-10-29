export default defineEventHandler(async (event) => {
  await requireServiceStaff(event)
  await ensureDb()

  const chat = await loadChatDetail(getRouterParam(event, 'id') ?? '')
  if (!chat)
    throw createError({ statusCode: 404, statusMessage: 'Chat not found' })

  // Published articles that match what the visitor has said so far.
  const visitorText = chat.messages.filter(m => m.authorType === 'visitor').map(m => m.body).join(' ').slice(0, 800)
  const articles = await searchKbArticles(visitorText, { limit: 3 })
  // What the AI agent did in this chat, newest first.
  const aiRuns = chat.aiAgentId ? (await useTenantDb().prepare(`${RUN_SELECT} WHERE ai_agent_runs.chat_id = ? ORDER BY ai_agent_runs.created_at DESC LIMIT 20`).all(chat.id) as Parameters<typeof mapRunRow>[0][]).map(mapRunRow) : []
  return { chat, articles, aiRuns }
})
