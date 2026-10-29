import type { KbArticle, KbStatus, KbVisibility } from '../../app/types/knowledge'

export interface KbRow {
  id: string
  title: string
  body: string
  status: KbStatus
  visibility: KbVisibility
  products: string | null
  reviewer_id: string | null
  reviewer_name?: string | null
  source_ticket_id: string | null
  author_id: string | null
  author_name: string | null
  version: number | string
  views: number | string
  helpful_yes: number | string
  helpful_no: number | string
  created_at: string
  updated_at: string
  published_at: string | null
}

export const KB_SELECT = `
  SELECT kb_articles.*, reviewer.name AS reviewer_name
  FROM kb_articles
  LEFT JOIN staff reviewer ON reviewer.id = kb_articles.reviewer_id
`

export function mapKbRow(row: KbRow): KbArticle {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    status: row.status,
    visibility: row.visibility,
    products: (row.products ?? '').split(',').map(p => p.trim()).filter(Boolean),
    reviewerId: row.reviewer_id ?? undefined,
    reviewerName: row.reviewer_name ?? undefined,
    sourceTicketId: row.source_ticket_id ?? undefined,
    authorId: row.author_id ?? undefined,
    authorName: row.author_name ?? undefined,
    version: Number(row.version),
    views: Number(row.views),
    helpfulYes: Number(row.helpful_yes),
    helpfulNo: Number(row.helpful_no),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at ?? undefined,
  }
}

export async function loadKbArticle(id: string) {
  const row = await useTenantDb().prepare(`${KB_SELECT} WHERE kb_articles.id = ?`).get(id) as KbRow | undefined
  return row ? mapKbRow(row) : null
}

const STOP_WORDS = new Set(['the', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'on', 'for', 'is', 'it', 'my', 'i', 'we', 'our', 'with', 'not', 'can', 'how', 'do', 'does', 'what', 'why', 'when', 'this', 'that', 'be', 'are', 'was', 'at', 'by', 'from', 'me', 'you', 'your', 'have', 'has'])

export function searchTerms(text: string) {
  return [...new Set(text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(word => word.length > 2 && !STOP_WORDS.has(word)))]
}

/**
 * Keyword relevance over published articles: title matches count three times as much as body
 * matches. Good enough for "articles that might answer this" without a search engine.
 */
export async function searchKbArticles(query: string, options: { publicOnly?: boolean, includeUnpublished?: boolean, excludeId?: string, limit?: number } = {}) {
  return (await searchKbArticlesScored(query, options)).map(result => result.article)
}

/**
 * Keyword search with a relevance score (title hits count 3, body hits 1) and the share of the
 * query's words that matched — the AI agent uses both to decide whether an article really covers
 * the question. `products` limits results to articles tagged with one of those products.
 */
export async function searchKbArticlesScored(query: string, options: { publicOnly?: boolean, includeUnpublished?: boolean, excludeId?: string, limit?: number, products?: string[] } = {}) {
  const terms = searchTerms(query).slice(0, 12)
  if (!terms.length)
    return []

  const where: string[] = []
  if (!options.includeUnpublished)
    where.push('kb_articles.status = \'published\'')
  if (options.publicOnly)
    where.push('kb_articles.visibility = \'public\'')
  const rows = await useTenantDb().prepare(`${KB_SELECT}${where.length ? ` WHERE ${where.join(' AND ')}` : ''}`).all() as KbRow[]
  const products = (options.products ?? []).map(p => p.toLowerCase())

  return rows
    .filter(row => row.id !== options.excludeId)
    .map(row => mapKbRow(row))
    .filter(article => !products.length || article.products.some(p => products.includes(p.toLowerCase())))
    .map((article) => {
      const title = article.title.toLowerCase()
      const body = article.body.toLowerCase()
      const matched = terms.filter(term => title.includes(term) || body.includes(term)).length
      const score = terms.reduce((sum, term) => sum + (title.includes(term) ? 3 : 0) + (body.includes(term) ? 1 : 0), 0)
      return { article, score, coverage: matched / terms.length }
    })
    .filter(result => result.score >= Math.min(2, terms.length))
    .sort((a, b) => b.score - a.score)
    .slice(0, options.limit ?? 5)
}

/** Staff who can write and read the knowledge base: the service desk and engineers, plus admins. */
export async function requireServiceStaff(event: Parameters<typeof requireSessionUser>[0]) {
  const user = await requireSessionUser(event)
  const allowed = ['admin', 'agent', 'engineer', 'engineering_coordinator', 'engineering_lead']
  if (!user.roles.some(role => allowed.includes(role)))
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  return user
}
