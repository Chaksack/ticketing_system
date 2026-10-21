export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing staff id' })
  }

  await ensureDb()
  const db = useTenantDb()

  const row = await db.prepare('SELECT email, hq_role FROM staff WHERE id = ?').get(id) as { email: string, hq_role: string | null } | undefined

  if (row && staffHqRole(row) === 'admin') {
    const admins = await db.prepare(`SELECT COUNT(*) AS count FROM staff WHERE hq_role = 'admin' AND status <> 'disabled'`).get() as { count: string | number }
    if (Number(admins.count) <= 1)
      throw createError({ statusCode: 400, statusMessage: 'Canopy HQ needs at least one HQ admin' })
  }

  await db.prepare('DELETE FROM push_subscriptions WHERE staff_id = ?').run(id)
  await db.prepare('DELETE FROM staff WHERE id = ?').run(id)

  // Frees the email so the person could join (or be invited to) another workspace.
  if (row)
    await unregisterDirectoryEmail(row.email, currentOrgId())

  return { success: true }
})
