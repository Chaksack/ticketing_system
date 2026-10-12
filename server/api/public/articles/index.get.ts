import type { PublicKbArticle } from '../../../../app/types/knowledge'

/** Customer portal: published, customer-visible articles matching what the customer is typing. */
export default defineEventHandler(async (event) => {
  applyPortalCors(event)
  await useWorkspaceFromRequest(event)
  await ensureDb()

  const q = String(getQuery(event).q ?? '').slice(0, 300)
  const articles = await searchKbArticles(q, { publicOnly: true, limit: 3 })
  return { articles: articles.map((a): PublicKbArticle => ({ id: a.id, title: a.title, body: a.body, updatedAt: a.updatedAt })) }
})
