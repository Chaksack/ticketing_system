import type { KbRow } from '../../utils/knowledge'

export default defineEventHandler(async (event) => {
  await requireServiceStaff(event)
  await ensureDb()

  const query = getQuery(event)
  const q = typeof query.q === 'string' ? query.q.trim() : ''
  if (q)
    return { articles: await searchKbArticles(q, { includeUnpublished: query.published !== '1', limit: 20 }) }

  const rows = await useTenantDb().prepare(`${KB_SELECT} ORDER BY kb_articles.updated_at DESC`).all() as KbRow[]
  return { articles: rows.map(mapKbRow) }
})
