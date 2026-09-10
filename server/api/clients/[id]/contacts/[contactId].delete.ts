import type { ClientContactRow } from '../../../../utils/mappers'

export default defineEventHandler(async (event) => {
  const user = await requireBd(event)

  const clientId = getRouterParam(event, 'id')
  const contactId = getRouterParam(event, 'contactId')

  if (!clientId || !contactId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing client id or contact id' })
  }

  await ensureDb()
  const db = useDatabase()

  const contact = await db.prepare('SELECT * FROM client_contacts WHERE id = ? AND client_id = ?').get(contactId, clientId) as ClientContactRow | undefined
  if (!contact) {
    throw createError({ statusCode: 404, statusMessage: 'Contact not found' })
  }

  await db.prepare('DELETE FROM client_contacts WHERE id = ?').run(contactId)

  await logClientActivity({
    clientId,
    type: 'contact_removed',
    actorId: user.id,
    actorName: user.name,
    fromValue: contact.name,
  })

  const client = await loadFullClient(clientId)
  return { client }
})
