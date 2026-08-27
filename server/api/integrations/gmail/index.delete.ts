export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  await ensureDb()

  const db = useDatabase()
  await db.prepare('UPDATE staff SET gmail_email = NULL, gmail_refresh_token = NULL, gmail_connected_at = NULL WHERE id = ?').run(user.id)

  return { success: true }
})
