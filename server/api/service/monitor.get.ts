import type { MonitorChat, MonitorStats } from '../../../app/types/supportDesk'
import type { LiveChatRow } from '../../utils/liveChat'

/** Conversation monitor: every open chat with its latest messages, plus today's numbers. */
export default defineEventHandler(async (event): Promise<{ chats: MonitorChat[], stats: MonitorStats }> => {
  await requireServiceStaff(event)
  await ensureDb()
  const db = useTenantDb()
  const rows = await db.prepare(`${CHAT_SELECT} WHERE live_chats.status <> 'closed' ORDER BY live_chats.started_at`).all() as LiveChatRow[]
  const ids = rows.map(r => r.id)
  const messages = ids.length
    ? await db.prepare(`SELECT chat_id, author_type, author_name, body, created_at FROM live_chat_messages WHERE chat_id IN (${ids.map(() => '?').join(', ')}) AND author_type <> 'note' ORDER BY created_at`).all(...ids) as { chat_id: string, author_type: string, author_name: string, body: string, created_at: string }[]
    : []
  const tags = await chatTags(ids)

  const chats: MonitorChat[] = rows.map((row) => {
    const chat = mapChatRow(row)
    const own = messages.filter(m => m.chat_id === row.id)
    const spoken = own.filter(m => m.author_type !== 'system')
    return {
      id: chat.id,
      status: chat.status,
      visitorName: chat.visitorName,
      visitorEmail: chat.visitorEmail,
      clientName: chat.clientName,
      subject: chat.subject,
      aiAgentName: chat.aiAgentName,
      assigneeName: chat.assigneeName,
      handoffReason: chat.handoffReason,
      aiThinking: !!row.ai_thinking_at && Date.now() - new Date(row.ai_thinking_at).getTime() < 90_000,
      startedAt: chat.startedAt,
      waitingSince: chat.status === 'waiting' ? (chat.handedOffAt ?? chat.startedAt) : undefined,
      lastMessageAt: chat.lastMessageAt,
      lastAuthor: spoken.at(-1)?.author_type,
      messageCount: spoken.length,
      recent: own.slice(-3).map(m => ({ authorType: m.author_type, authorName: m.author_name, body: m.body.slice(0, 280), createdAt: m.created_at })),
      tags: tags.get(row.id) ?? [],
    }
  })

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const since = today.toISOString()
  const day = await db.prepare(`
    SELECT COUNT(*) AS started,
      SUM(CASE WHEN ai_agent_id IS NOT NULL THEN 1 ELSE 0 END) AS ai,
      SUM(CASE WHEN handed_off_at IS NOT NULL THEN 1 ELSE 0 END) AS handed,
      SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) AS closed
    FROM live_chats WHERE started_at >= ?
  `).get(since) as Record<string, string | number | null>
  const firsts = await db.prepare('SELECT started_at, first_response_at FROM live_chats WHERE started_at >= ? AND first_response_at IS NOT NULL').all(since) as { started_at: string, first_response_at: string }[]
  const avg = firsts.length ? Math.round(firsts.reduce((sum, r) => sum + (new Date(r.first_response_at).getTime() - new Date(r.started_at).getTime()) / 1000, 0) / firsts.length) : undefined

  return {
    chats,
    stats: {
      startedToday: Number(day.started ?? 0),
      aiHandledToday: Number(day.ai ?? 0),
      handedOffToday: Number(day.handed ?? 0),
      closedToday: Number(day.closed ?? 0),
      avgFirstResponseSeconds: avg,
      agentsOnline: (await liveChatQueueStats()).agentsOnline,
    },
  }
})
