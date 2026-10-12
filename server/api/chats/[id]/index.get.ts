export default defineEventHandler(async (event) => {
  await requireServiceStaff(event)
  await ensureDb()

  const chat = await loadChatDetail(getRouterParam(event, 'id') ?? '')
  if (!chat)
    throw createError({ statusCode: 404, statusMessage: 'Chat not found' })

  // Published articles that match what the visitor has said so far.
  const visitorText = chat.messages.filter(m => m.authorType === 'visitor').map(m => m.body).join(' ').slice(0, 800)
  const articles = await searchKbArticles(visitorText, { limit: 3 })
  return { chat, articles }
})
