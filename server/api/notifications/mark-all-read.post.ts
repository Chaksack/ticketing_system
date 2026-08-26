export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)

  await ensureDb()
  const db = useDatabase()

  await db.prepare('UPDATE notifications SET read = 1, read_at = ? WHERE staff_id = ? AND read = 0').run(new Date().toISOString(), user.id)

  return { success: true }
})
