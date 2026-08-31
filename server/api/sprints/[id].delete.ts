export default defineEventHandler(async (event) => {
  await requireBd(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing sprint id' })
  }

  await ensureDb()
  const db = useDatabase()

  const existing = await db.prepare('SELECT * FROM sprints WHERE id = ?').get(id)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Sprint not found' })
  }

  // Deleting a sprint unlinks its tasks (they fall back to the backlog) rather than deleting them.
  await db.prepare('UPDATE tasks SET sprint_id = NULL WHERE sprint_id = ?').run(id)
  await db.prepare('DELETE FROM sprints WHERE id = ?').run(id)

  return { success: true }
})
