import type { KbVisibility } from '../../../../app/types/knowledge'

type KbAction = 'submit_review' | 'publish' | 'unpublish' | 'archive' | 'restore'

interface PatchBody {
  title?: string
  body?: string
  visibility?: KbVisibility
  products?: string[]
  reviewerId?: string | null
  action?: KbAction
}

/**
 * Edits and the review flow: Draft → (Send for review) → In review → Published. Only an admin or
 * the assigned reviewer can publish; anyone on the service desk can draft and edit. Editing a
 * published article bumps its version.
 */
export default defineEventHandler(async (event) => {
  const user = await requireServiceStaff(event)
  const id = getRouterParam(event, 'id') ?? ''
  const body = await readBody<PatchBody>(event) ?? {}

  await ensureDb()
  const db = useTenantDb()
  const article = await loadKbArticle(id)
  if (!article)
    throw createError({ statusCode: 404, statusMessage: 'Article not found' })

  const isAdmin = user.roles.includes('admin')
  const now = new Date().toISOString()
  const sets: string[] = []
  const params: (string | number | null)[] = []
  const set = (column: string, value: string | number | null) => {
    sets.push(`${column} = ?`)
    params.push(value)
  }

  const contentChanged = (body.title !== undefined && body.title.trim() !== article.title) || (body.body !== undefined && body.body !== article.body)
  if (body.title !== undefined) {
    if (body.title.trim().length < 3)
      throw createError({ statusCode: 400, statusMessage: 'Give the article a title of at least 3 characters' })
    set('title', body.title.trim())
  }
  if (body.body !== undefined)
    set('body', body.body)
  if (body.visibility !== undefined)
    set('visibility', body.visibility === 'public' ? 'public' : 'internal')
  if (body.products !== undefined)
    set('products', body.products.map(p => p.trim()).filter(Boolean).join(', ') || null)
  if (body.reviewerId !== undefined) {
    if (body.reviewerId) {
      const reviewer = await db.prepare('SELECT id FROM staff WHERE id = ? AND status = \'active\'').get(body.reviewerId)
      if (!reviewer)
        throw createError({ statusCode: 400, statusMessage: 'Pick an active staff member to review' })
    }
    set('reviewer_id', body.reviewerId || null)
  }
  if (contentChanged && article.status === 'published')
    set('version', article.version + 1)

  const reviewerId = body.reviewerId !== undefined ? body.reviewerId : article.reviewerId
  switch (body.action) {
    case 'submit_review':
      if (!reviewerId)
        throw createError({ statusCode: 400, statusMessage: 'Choose who should review it first' })
      set('status', 'in_review')
      if (reviewerId !== user.id) {
        await createNotification({ staffId: reviewerId, type: 'kb_review', title: `Review requested: ${article.title}`, body: `${user.name} sent ${id} for review.`, url: `/knowledge/${id}` })
      }
      break
    case 'publish':
      if (!isAdmin && reviewerId !== user.id)
        throw createError({ statusCode: 403, statusMessage: 'Only the reviewer or an admin can publish this article' })
      set('status', 'published')
      set('published_at', now)
      break
    case 'unpublish':
      if (!isAdmin && reviewerId !== user.id)
        throw createError({ statusCode: 403, statusMessage: 'Only the reviewer or an admin can unpublish this article' })
      set('status', 'draft')
      break
    case 'archive':
      set('status', 'archived')
      break
    case 'restore':
      set('status', 'draft')
      break
  }

  if (sets.length) {
    set('updated_at', now)
    await db.prepare(`UPDATE kb_articles SET ${sets.join(', ')} WHERE id = ?`).run(...params, id)
  }

  return { article: await loadKbArticle(id) }
})
