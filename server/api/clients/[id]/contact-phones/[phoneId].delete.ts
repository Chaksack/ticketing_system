export default defineEventHandler(async (event) => {
  await requireBd(event)

  const clientId = getRouterParam(event, 'id')
  const phoneId = getRouterParam(event, 'phoneId')

  if (!clientId || !phoneId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing client id or phone id' })
  }

  await ensureDb()
  const db = useDatabase()

  await db.prepare('DELETE FROM client_contact_phones WHERE id = ? AND client_id = ?').run(phoneId, clientId)

  const client = await loadFullClient(clientId)
  return { client }
})
