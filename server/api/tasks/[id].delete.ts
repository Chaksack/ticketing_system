export default defineEventHandler(async (event) => {
  await requireBd(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing task id' })
  }

  await ensureDb()
  const db = useDatabase()

  await db.prepare('DELETE FROM tasks WHERE parent_task_id = ?').run(id)
  await db.prepare('UPDATE tasks SET epic_id = NULL WHERE epic_id = ?').run(id)
  await db.prepare('DELETE FROM tasks WHERE id = ?').run(id)

  return { success: true }
})
