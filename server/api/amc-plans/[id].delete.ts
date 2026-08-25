export default defineEventHandler(async (event) => {
  await requireBd(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing plan id' })
  }

  await ensureDb()
  const db = useDatabase()

  await db.prepare('DELETE FROM amc_plans WHERE id = ?').run(id)

  return { success: true }
})
