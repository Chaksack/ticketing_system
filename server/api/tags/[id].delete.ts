export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing tag id' })
  }

  await ensureDb()
  const db = useDatabase()

  await db.prepare('DELETE FROM ticket_tags WHERE tag_id = ?').run(id)
  await db.prepare('DELETE FROM tags WHERE id = ?').run(id)

  return { success: true }
})
