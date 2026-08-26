export default defineEventHandler(async (event) => {
  await requireBd(event)

  const clientId = getRouterParam(event, 'id')
  const emailId = getRouterParam(event, 'emailId')

  if (!clientId || !emailId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing client id or email id' })
  }

  await ensureDb()
  const db = useDatabase()

  await db.prepare('DELETE FROM client_contact_emails WHERE id = ? AND client_id = ?').run(emailId, clientId)

  const client = await loadFullClient(clientId)
  return { client }
})
