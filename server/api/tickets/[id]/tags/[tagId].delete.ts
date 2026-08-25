import type { TagRow } from '../../../../utils/mappers'

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)

  const id = getRouterParam(event, 'id')
  const tagId = getRouterParam(event, 'tagId')

  if (!id || !tagId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing ticket id or tag id' })
  }

  await ensureDb()
  const db = useDatabase()

  const tag = await db.prepare('SELECT * FROM tags WHERE id = ?').get(tagId) as TagRow | undefined

  await db.prepare('DELETE FROM ticket_tags WHERE ticket_id = ? AND tag_id = ?').run(id, tagId)

  await logTicketActivity({
    ticketId: id,
    type: 'tag_removed',
    actorId: user.id,
    actorName: user.name,
    fromValue: tag?.name ?? tagId,
  })
  await touchTicket(id)

  const updated = await loadFullTicket(id)
  return { ticket: updated }
})
