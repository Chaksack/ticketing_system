export default defineEventHandler(async (event) => {
  await requireBd(event)

  const leadId = getRouterParam(event, 'id')
  const emailId = getRouterParam(event, 'emailId')

  if (!leadId || !emailId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing lead id or email id' })
  }

  await ensureDb()
  const db = useDatabase()

  await db.prepare('DELETE FROM lead_contact_emails WHERE id = ? AND lead_id = ?').run(emailId, leadId)

  const lead = await loadFullLead(leadId)
  return { lead }
})
