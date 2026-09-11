export default defineEventHandler(async (event) => {
  await requireBd(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing quote id' })
  }

  await ensureDb()
  const db = useDatabase()

  await db.prepare('DELETE FROM quote_line_items WHERE quote_id = ?').run(id)
  await db.prepare('DELETE FROM quotes WHERE id = ?').run(id)

  return { success: true }
})
