export default defineEventHandler(async (event) => {
  await requireFinance(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing budget id' })
  }

  await ensureDb()
  const db = useDatabase()

  await db.prepare('DELETE FROM budgets WHERE id = ?').run(id)

  return { success: true }
})
