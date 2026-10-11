export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing staff id' })
  }

  await ensureDb()
  const db = useTenantDb()

  const row = await db.prepare('SELECT email FROM staff WHERE id = ?').get(id) as { email: string } | undefined

  await db.prepare('DELETE FROM push_subscriptions WHERE staff_id = ?').run(id)
  await db.prepare('DELETE FROM staff WHERE id = ?').run(id)

  // Frees the email so the person could join (or be invited to) another workspace.
  if (row)
    await unregisterDirectoryEmail(row.email, currentOrgId())

  return { success: true }
})
