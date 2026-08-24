export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing macro id' })
  }

  await ensureDb()
  const db = useDatabase()

  await db.prepare('DELETE FROM macros WHERE id = ?').run(id)

  return { success: true }
})
