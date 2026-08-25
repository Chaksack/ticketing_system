export default defineEventHandler(async (event) => {
  await requireSessionUser(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing page id' })
  }

  await ensureDb()
  const db = useDatabase()
  await db.prepare('UPDATE pages SET acknowledged = 1 WHERE id = ?').run(id)

  return { success: true }
})
