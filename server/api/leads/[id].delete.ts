export default defineEventHandler(async (event) => {
  await requireBd(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing lead id' })
  }

  await ensureDb()
  const db = useDatabase()

  await db.prepare('DELETE FROM lead_activity WHERE lead_id = ?').run(id)
  await db.prepare('DELETE FROM leads WHERE id = ?').run(id)

  return { success: true }
})
