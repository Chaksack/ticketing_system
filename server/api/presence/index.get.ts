import type { PresenceRow } from '../../utils/presence'

export default defineEventHandler(async (event) => {
  await requireSessionUser(event)
  await ensureDb()

  const db = useDatabase()
  const rows = await db.prepare('SELECT id, last_active_at, presence_override, status_text, status_emoji, status_expires_at FROM staff').all() as PresenceRow[]

  return { presences: rows.map(mapPresenceRow) }
})
