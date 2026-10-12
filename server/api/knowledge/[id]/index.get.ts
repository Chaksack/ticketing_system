export default defineEventHandler(async (event) => {
  await requireServiceStaff(event)
  await ensureDb()

  const article = await loadKbArticle(getRouterParam(event, 'id') ?? '')
  if (!article)
    throw createError({ statusCode: 404, statusMessage: 'Article not found' })

  // Older articles on the same topic, so the author can link instead of duplicating.
  const similar = await searchKbArticles(`${article.title} ${article.title}`, { includeUnpublished: true, excludeId: article.id, limit: 3 })
  return { article, similar }
})
