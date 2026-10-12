import type { KbVisibility } from '../../../app/types/knowledge'

export default defineEventHandler(async (event) => {
  const user = await requireServiceStaff(event)
  const body = await readBody<{ title?: string, body?: string, visibility?: KbVisibility, products?: string[], sourceTicketId?: string }>(event)

  const title = body?.title?.trim()
  if (!title || title.length < 3)
    throw createError({ statusCode: 400, statusMessage: 'Give the article a title of at least 3 characters' })

  await ensureDb()
  const id = await nextPrefixedId('kb_article', 'KB')
  const now = new Date().toISOString()
  await useTenantDb().prepare(`
    INSERT INTO kb_articles (id, title, body, status, visibility, products, source_ticket_id, author_id, author_name, created_at, updated_at)
    VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?)
  `).run(id, title, body.body ?? '', body.visibility === 'public' ? 'public' : 'internal', (body.products ?? []).join(', ') || null, body.sourceTicketId ?? null, user.id, user.name, now, now)

  setResponseStatus(event, 201)
  return { article: await loadKbArticle(id) }
})
