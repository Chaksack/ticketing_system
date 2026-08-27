export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  await ensureDb()

  const db = useDatabase()
  await db.prepare('UPDATE staff SET last_active_at = ? WHERE id = ?').run(new Date().toISOString(), user.id)

  return { success: true }
})
