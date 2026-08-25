export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing staff id' })
  }

  await ensureDb()
  const db = useDatabase()

  await db.prepare('DELETE FROM push_subscriptions WHERE staff_id = ?').run(id)
  await db.prepare('DELETE FROM staff WHERE id = ?').run(id)

  return { success: true }
})
