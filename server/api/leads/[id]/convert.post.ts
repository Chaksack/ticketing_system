import type { LeadRow } from '../../../utils/mappers'

export default defineEventHandler(async (event) => {
  const user = await requireBd(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing lead id' })
  }

  await ensureDb()
  const db = useDatabase()

  const lead = await db.prepare('SELECT * FROM leads WHERE id = ?').get(id) as LeadRow | undefined
  if (!lead) {
    throw createError({ statusCode: 404, statusMessage: 'Lead not found' })
  }

  if (lead.converted_client_id) {
    throw createError({ statusCode: 400, statusMessage: 'Lead has already been converted' })
  }

  const clientId = await nextClientId()
  const now = new Date().toISOString()

  await db.prepare(`
    INSERT INTO clients (id, name, contact_name, contact_email, contact_phone, stage, notes, assigned_to, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)
  `).run(
    clientId,
    lead.name,
    lead.contact_name,
    lead.contact_email,
    lead.contact_phone,
    lead.notes,
    lead.assigned_to,
    now,
    now,
  )

  await logClientActivity({
    clientId,
    type: 'converted_from_lead',
    actorId: user.id,
    actorName: user.name,
    message: `Converted from lead ${lead.id}`,
  })

  await db.prepare(`
    UPDATE leads SET stage = 'won', converted_client_id = ?, updated_at = ? WHERE id = ?
  `).run(clientId, now, id)

  await logLeadActivity({
    leadId: id,
    type: 'converted',
    actorId: user.id,
    actorName: user.name,
    toValue: clientId,
    message: `Converted to client ${clientId}`,
  })

  const client = await loadFullClient(clientId)

  return { client }
})
