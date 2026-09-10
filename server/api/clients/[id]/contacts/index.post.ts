interface NewContactBody {
  name?: string
  title?: string
  email?: string
  phone?: string
  isPrimary?: boolean
}

export default defineEventHandler(async (event) => {
  const user = await requireBd(event)

  const clientId = getRouterParam(event, 'id')
  const body = await readBody<NewContactBody>(event)

  if (!clientId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing client id' })
  }

  if (!body?.name?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'name is required' })
  }

  await ensureDb()
  const db = useDatabase()

  const client = await db.prepare('SELECT id FROM clients WHERE id = ?').get(clientId)
  if (!client) {
    throw createError({ statusCode: 404, statusMessage: 'Client not found' })
  }

  const isPrimary = !!body.isPrimary
  const now = new Date().toISOString()

  // At most one primary contact per client — starting a new one takes over the role.
  if (isPrimary) {
    await db.prepare('UPDATE client_contacts SET is_primary = 0, updated_at = ? WHERE client_id = ?').run(now, clientId)
  }

  const id = await nextClientContactId()

  await db.prepare(`
    INSERT INTO client_contacts (id, client_id, name, title, email, phone, is_primary, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, clientId, body.name.trim(), body.title?.trim() || null, body.email?.trim() || null, body.phone?.trim() || null, isPrimary ? 1 : 0, now, now)

  await logClientActivity({
    clientId,
    type: 'contact_added',
    actorId: user.id,
    actorName: user.name,
    toValue: body.name.trim(),
  })

  const updatedClient = await loadFullClient(clientId)
  setResponseStatus(event, 201)
  return { client: updatedClient }
})
