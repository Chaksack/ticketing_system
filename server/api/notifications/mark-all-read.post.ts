export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)

  await ensureDb()
  const db = useDatabase()

  await db.prepare('UPDATE notifications SET read = 1 WHERE staff_id = ? AND read = 0').run(user.id)

  return { success: true }
})
