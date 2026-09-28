export default defineEventHandler(async (event) => {
  await requireBd(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing client id' })
  }

  await ensureDb()
  const db = useDatabase()

  const existing = await db.prepare('SELECT id FROM clients WHERE id = ?').get(id)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Client not found' })
  }

  await deleteClientCascade(id)

  return { success: true }
})
