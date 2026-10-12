import type { PublicKbArticle } from '../../../../app/types/knowledge'

/** Customer-facing view of one published, public article (/kb/<workspace>/<id>). */
export default defineEventHandler(async (event) => {
  const org = await useWorkspaceFromRequest(event)
  await ensureDb()

  const article = await loadKbArticle(getRouterParam(event, 'id') ?? '')
  if (!article || article.status !== 'published' || article.visibility !== 'public')
    throw createError({ statusCode: 404, statusMessage: 'This article was not found' })

  const workspace = org ?? await getOrganization(currentOrgId())
  return {
    article: { id: article.id, title: article.title, body: article.body, updatedAt: article.updatedAt } satisfies PublicKbArticle,
    workspace: workspace ? { name: workspace.name, slug: workspace.slug, isHome: workspace.isHome } : null,
  }
})
