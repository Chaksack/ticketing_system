import type { TagRow } from '../../../utils/mappers'

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)

  const id = getRouterParam(event, 'id')
  const body = await readBody<{ tagId?: string, name?: string }>(event)

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing ticket id' })
  }

  await ensureDb()
  const db = useDatabase()

  const ticket = await db.prepare('SELECT id FROM tickets WHERE id = ?').get(id) as { id: string } | undefined
  if (!ticket) {
    throw createError({ statusCode: 404, statusMessage: 'Ticket not found' })
  }

  let tag: TagRow | undefined

  if (body.tagId) {
    tag = await db.prepare('SELECT * FROM tags WHERE id = ?').get(body.tagId) as TagRow | undefined
    if (!tag) {
      throw createError({ statusCode: 404, statusMessage: 'Tag not found' })
    }
  }
  else if (body.name?.trim()) {
    const name = body.name.trim()
    tag = await db.prepare('SELECT * FROM tags WHERE name = ?').get(name) as TagRow | undefined
    if (!tag) {
      const tagId = await nextTagId()
      const now = new Date().toISOString()
      await db.prepare('INSERT INTO tags (id, name, color, created_at) VALUES (?, ?, ?, ?)').run(tagId, name, 'gray', now)
      tag = { id: tagId, name, color: 'gray', created_at: now }
    }
  }
  else {
    throw createError({ statusCode: 400, statusMessage: 'tagId or name is required' })
  }

  await db.prepare('INSERT INTO ticket_tags (ticket_id, tag_id) VALUES (?, ?) ON CONFLICT DO NOTHING').run(id, tag.id)

  await logTicketActivity({
    ticketId: id,
    type: 'tag_added',
    actorId: user.id,
    actorName: user.name,
    toValue: tag.name,
  })
  await touchTicket(id)

  const updated = await loadFullTicket(id)
  return { ticket: updated }
})
