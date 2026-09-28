export default defineEventHandler(async (event) => {
  await requireBd(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing project id' })
  }

  await ensureDb()
  const db = useDatabase()

  const existing = await db.prepare('SELECT id FROM projects WHERE id = ?').get(id)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Project not found' })
  }

  await deleteProjectCascade(id)

  return { success: true }
})
