export default defineEventHandler(async (event) => {
  const user = await requireServiceStaff(event)
  const id = getRouterParam(event, 'id') ?? ''
  await ensureDb()

  const article = await loadKbArticle(id)
  if (!article)
    throw createError({ statusCode: 404, statusMessage: 'Article not found' })
  // Published articles may be linked from replies and the portal: archive those instead.
  if (!user.roles.includes('admin') && (article.authorId !== user.id || article.status === 'published'))
    throw createError({ statusCode: 403, statusMessage: 'Only an admin, or the author of an unpublished article, can delete it' })

  await useTenantDb().prepare('DELETE FROM kb_articles WHERE id = ?').run(id)
  return { ok: true }
})
