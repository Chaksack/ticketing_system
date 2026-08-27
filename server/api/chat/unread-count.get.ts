export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  await ensureDb()

  const db = useDatabase()
  const row = await db.prepare(`
    SELECT COUNT(*) as count
    FROM chat_messages m
    JOIN chat_channel_members cm ON cm.channel_id = m.channel_id
    WHERE cm.staff_id = ?
      AND m.author_id != ?
      AND m.created_at > COALESCE(cm.last_read_at, '1970-01-01T00:00:00.000Z')
  `).get(user.id, user.id) as { count: number | string }

  return { unreadCount: Number(row.count) }
})
