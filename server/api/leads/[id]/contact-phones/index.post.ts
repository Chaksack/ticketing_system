export default defineEventHandler(async (event) => {
  await requireBd(event)

  const leadId = getRouterParam(event, 'id')
  const body = await readBody<{ phone?: string, label?: string }>(event)

  if (!leadId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing lead id' })
  }

  if (!body?.phone?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'phone is required' })
  }

  await ensureDb()
  const db = useDatabase()

  const lead = await db.prepare('SELECT id FROM leads WHERE id = ?').get(leadId)
  if (!lead) {
    throw createError({ statusCode: 404, statusMessage: 'Lead not found' })
  }

  const id = await nextLeadContactPhoneId()
  const now = new Date().toISOString()

  await db.prepare('INSERT INTO lead_contact_phones (id, lead_id, phone, label, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, leadId, body.phone.trim(), body.label?.trim() || null, now)

  const updatedLead = await loadFullLead(leadId)
  setResponseStatus(event, 201)
  return { lead: updatedLead }
})
