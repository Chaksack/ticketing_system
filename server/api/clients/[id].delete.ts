export default defineEventHandler(async (event) => {
  await requireBd(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing client id' })
  }

  await ensureDb()
  const db = useDatabase()

  await db.prepare('DELETE FROM client_activity WHERE client_id = ?').run(id)
  await db.prepare('DELETE FROM client_amc_contracts WHERE client_id = ?').run(id)
  await db.prepare('DELETE FROM projects WHERE client_id = ?').run(id)
  await db.prepare('DELETE FROM client_assignees WHERE client_id = ?').run(id)
  await db.prepare('DELETE FROM client_contact_emails WHERE client_id = ?').run(id)
  await db.prepare('DELETE FROM client_contact_phones WHERE client_id = ?').run(id)
  await db.prepare('DELETE FROM clients WHERE id = ?').run(id)

  return { success: true }
})
