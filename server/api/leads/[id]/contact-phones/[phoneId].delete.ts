export default defineEventHandler(async (event) => {
  await requireBd(event)

  const leadId = getRouterParam(event, 'id')
  const phoneId = getRouterParam(event, 'phoneId')

  if (!leadId || !phoneId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing lead id or phone id' })
  }

  await ensureDb()
  const db = useDatabase()

  await db.prepare('DELETE FROM lead_contact_phones WHERE id = ? AND lead_id = ?').run(phoneId, leadId)

  const lead = await loadFullLead(leadId)
  return { lead }
})
