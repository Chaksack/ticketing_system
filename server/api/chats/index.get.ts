import type { LiveChatRow } from '../../utils/liveChat'

/** The live-chat inbox: open chats (waiting first, then by latest message), or recent closed ones. */
export default defineEventHandler(async (event) => {
  await requireServiceStaff(event)
  await ensureDb()

  const closed = getQuery(event).status === 'closed'
  const db = useTenantDb()
  const rows = closed
    ? await db.prepare(`${CHAT_SELECT} WHERE live_chats.status = 'closed' ORDER BY live_chats.closed_at DESC LIMIT 100`).all() as LiveChatRow[]
    : await db.prepare(`${CHAT_SELECT} WHERE live_chats.status <> 'closed' ORDER BY CASE live_chats.status WHEN 'waiting' THEN 0 ELSE 1 END, live_chats.last_message_at DESC`).all() as LiveChatRow[]

  return { chats: rows.map(mapChatRow), stats: await liveChatQueueStats() }
})
