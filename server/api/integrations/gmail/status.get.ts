export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  await ensureDb()

  const db = useDatabase()
  const row = await db.prepare('SELECT gmail_email, gmail_connected_at FROM staff WHERE id = ?').get(user.id) as { gmail_email: string | null, gmail_connected_at: string | null } | undefined

  return {
    connected: !!row?.gmail_email,
    email: row?.gmail_email ?? undefined,
    connectedAt: row?.gmail_connected_at ?? undefined,
  }
})
