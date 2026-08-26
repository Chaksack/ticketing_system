export default defineEventHandler(async (event) => {
  await requireBd(event)

  const leadId = getRouterParam(event, 'id')
  const body = await readBody<{ email?: string, label?: string }>(event)

  if (!leadId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing lead id' })
  }

  if (!body?.email?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'email is required' })
  }

  await ensureDb()
  const db = useDatabase()

  const lead = await db.prepare('SELECT id FROM leads WHERE id = ?').get(leadId)
  if (!lead) {
    throw createError({ statusCode: 404, statusMessage: 'Lead not found' })
  }

  const id = await nextLeadContactEmailId()
  const now = new Date().toISOString()

  await db.prepare('INSERT INTO lead_contact_emails (id, lead_id, email, label, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, leadId, body.email.trim(), body.label?.trim() || null, now)

  const updatedLead = await loadFullLead(leadId)
  setResponseStatus(event, 201)
  return { lead: updatedLead }
})
