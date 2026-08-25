export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing notification id' })
  }

  await ensureDb()
  const db = useDatabase()

  await db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND staff_id = ?').run(id, user.id)

  return { success: true }
})
