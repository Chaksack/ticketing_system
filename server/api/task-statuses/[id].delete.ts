export default defineEventHandler(async (event) => {
  await requireBd(event)

  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing status id' })
  }

  await ensureDb()
  const db = useDatabase()

  const existing = await db.prepare('SELECT * FROM task_statuses WHERE id = ?').get(id)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Status not found' })
  }

  const taskCount = await db.prepare('SELECT COUNT(*) as count FROM tasks WHERE status = ?').get(id) as { count: number | string }
  if (Number(taskCount.count) > 0) {
    throw createError({ statusCode: 409, statusMessage: 'Move or delete the tasks in this column before deleting it' })
  }

  await db.prepare('DELETE FROM task_statuses WHERE id = ?').run(id)

  return { success: true }
})
