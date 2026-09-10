import type { TenderRow } from '../../../utils/mappers'

export default defineEventHandler(async (event) => {
  const user = await requireBd(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing tender id' })
  }

  await ensureDb()
  const db = useDatabase()

  const tender = await db.prepare('SELECT * FROM tenders WHERE id = ?').get(id) as TenderRow | undefined
  if (!tender) {
    throw createError({ statusCode: 404, statusMessage: 'Tender not found' })
  }

  if (tender.converted_client_id) {
    throw createError({ statusCode: 400, statusMessage: 'Tender has already been converted' })
  }

  if (tender.stage !== 'won') {
    throw createError({ statusCode: 400, statusMessage: 'Only a won tender can be converted to a client' })
  }

  const clientId = await nextClientId()
  const now = new Date().toISOString()
  const tenderAssignees = await getTenderAssignees(id)

  await db.prepare(`
    INSERT INTO clients (id, name, contact_name, contact_email, contact_phone, stage, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)
  `).run(
    clientId,
    tender.title,
    tender.contact_name,
    tender.contact_email,
    tender.contact_phone,
    tender.notes,
    now,
    now,
  )

  await setClientAssignees(clientId, tenderAssignees.map(a => a.id))

  await logClientActivity({
    clientId,
    type: 'converted_from_lead',
    actorId: user.id,
    actorName: user.name,
    message: `Converted from tender ${tender.id}`,
  })

  await db.prepare(`
    UPDATE tenders SET converted_client_id = ?, updated_at = ? WHERE id = ?
  `).run(clientId, now, id)

  await logTenderActivity({
    tenderId: id,
    type: 'converted',
    actorId: user.id,
    actorName: user.name,
    toValue: clientId,
    message: `Converted to client ${clientId}`,
  })

  const client = await loadFullClient(clientId)

  return { client }
})
