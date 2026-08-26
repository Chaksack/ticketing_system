export default defineEventHandler(async (event) => {
  await requireBd(event)

  const clientId = getRouterParam(event, 'id')
  const body = await readBody<{ email?: string, label?: string }>(event)

  if (!clientId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing client id' })
  }

  if (!body?.email?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'email is required' })
  }

  await ensureDb()
  const db = useDatabase()

  const client = await db.prepare('SELECT id FROM clients WHERE id = ?').get(clientId)
  if (!client) {
    throw createError({ statusCode: 404, statusMessage: 'Client not found' })
  }

  const id = await nextClientContactEmailId()
  const now = new Date().toISOString()

  await db.prepare('INSERT INTO client_contact_emails (id, client_id, email, label, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, clientId, body.email.trim(), body.label?.trim() || null, now)

  const updatedClient = await loadFullClient(clientId)
  setResponseStatus(event, 201)
  return { client: updatedClient }
})
