export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing ticket id' })
  }

  await ensureDb()
  const db = useDatabase()

  await db.prepare('DELETE FROM ticket_replies WHERE ticket_id = ?').run(id)
  await db.prepare('DELETE FROM ticket_activity WHERE ticket_id = ?').run(id)
  await db.prepare('DELETE FROM ticket_tags WHERE ticket_id = ?').run(id)
  await db.prepare('DELETE FROM pages WHERE ticket_id = ?').run(id)
  await db.prepare('DELETE FROM notifications WHERE ticket_id = ?').run(id)
  await db.prepare('DELETE FROM tickets WHERE id = ?').run(id)

  return { success: true }
})
