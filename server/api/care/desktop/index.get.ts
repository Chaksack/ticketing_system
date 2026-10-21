import type { CareConversation } from '../../../../app/types/care'

/**
 * The Care agent desktop: open conversations across every client the agent is certified for,
 * read from each client's own workspace. Web chats waiting or with a Care agent; email tickets
 * nobody at the client has picked up.
 */
export default defineEventHandler(async (event) => {
  const user = await requireCareStaff(event)
  const engagements = (await runningEngagements()).filter(e => canWorkEngagement(user, e))
  const conversations: CareConversation[] = []
  let handledToday = 0
  const todayStart = new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString()
  const author = careAuthorName(user.name)

  for (const engagement of engagements) {
    await runWithTenant(engagement.orgId, async () => {
      await ensureDb()
      const db = useTenantDb()
      if (engagement.channels.includes('Web chat')) {
        const chats = await db.prepare(`SELECT id, visitor_name, subject, status, started_at, last_message_at, assignee_name FROM live_chats WHERE status <> 'closed' AND (assignee_id IS NULL OR care_handled = 1) ORDER BY started_at`).all() as { id: string, visitor_name: string, subject: string | null, status: string, started_at: string, assignee_name: string | null }[]
        conversations.push(...chats.map(c => ({ orgId: engagement.orgId, orgName: engagement.orgName ?? engagement.orgId, engagementId: engagement.id, kind: 'chat' as const, id: c.id, customer: c.visitor_name, preview: c.subject ?? '', status: c.status, waitingSince: c.started_at, assigneeName: c.assignee_name ?? undefined })))
        const sentChats = await db.prepare('SELECT COUNT(DISTINCT chat_id) AS count FROM live_chat_messages WHERE author_name = ? AND created_at >= ?').get(user.name, todayStart) as { count: string | number }
        handledToday += Number(sentChats.count)
      }
      if (engagement.channels.includes('Email')) {
        const tickets = await db.prepare(`SELECT id, requester, subject, status, created_at FROM tickets WHERE status IN ('open', 'in-progress') AND assignee_id IS NULL ORDER BY created_at LIMIT 50`).all() as { id: string, requester: string, subject: string, status: string, created_at: string }[]
        conversations.push(...tickets.map(t => ({ orgId: engagement.orgId, orgName: engagement.orgName ?? engagement.orgId, engagementId: engagement.id, kind: 'ticket' as const, id: t.id, customer: t.requester, preview: t.subject, status: t.status, waitingSince: t.created_at })))
        const sentTickets = await db.prepare('SELECT COUNT(DISTINCT ticket_id) AS count FROM ticket_replies WHERE care_agent = 1 AND author = ? AND created_at >= ?').get(author, todayStart) as { count: string | number }
        handledToday += Number(sentTickets.count)
      }
    })
  }

  await ensureCareTables()
  const recent = await useControlDb().prepare('SELECT score FROM cp_care_evaluations WHERE agent_id = ? ORDER BY created_at DESC LIMIT 10').all(user.id) as { score: number }[]
  const shift = await useControlDb().prepare('SELECT start_hour, end_hour FROM cp_care_shifts WHERE staff_id = ? AND date = ? ORDER BY start_hour LIMIT 1').get(user.id, new Date().toISOString().slice(0, 10)) as { start_hour: number, end_hour: number } | undefined

  return {
    engagements: engagements.map(e => ({ id: e.id, orgId: e.orgId, orgName: e.orgName, greeting: e.greeting, slaText: e.slaText, dos: e.dos, donts: e.donts, orgSlug: e.orgSlug })),
    conversations: conversations.sort((a, b) => a.waitingSince.localeCompare(b.waitingSince)),
    stats: {
      handledToday,
      quality: recent.length ? Math.round(recent.reduce((s, r) => s + Number(r.score), 0) / recent.length) : null,
      evaluations: recent.length,
      shift: shift ? `${String(shift.start_hour).padStart(2, '0')}:00–${String(shift.end_hour).padStart(2, '0')}:00` : null,
    },
  }
})
