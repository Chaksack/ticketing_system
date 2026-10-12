import type { CareEvaluation } from '../../../app/types/care'

/**
 * Quality: recent conversations Canopy Care agents handled (from each client's workspace) that
 * haven't been evaluated yet, plus the evaluations already done.
 */
export default defineEventHandler(async (event) => {
  await requirePlatformStaff(event)
  await ensureCareTables()
  const engagements = (await listEngagements()).filter(e => e.stage !== 'scope')
  const evaluations = (await useControlDb().prepare('SELECT * FROM cp_care_evaluations ORDER BY created_at DESC LIMIT 100').all() as Record<string, any>[]).map(mapEvaluationRow)
  const evaluated = new Set(evaluations.map(e => `${e.orgId}:${e.refType}:${e.refId}`))
  const since = new Date(Date.now() - 14 * 86400000).toISOString()

  const toReview: { orgId: string, orgName: string, engagementId: string, kind: 'chat' | 'ticket', id: string, title: string, agentName: string, at: string }[] = []
  for (const engagement of engagements) {
    await runWithTenant(engagement.orgId, async () => {
      await ensureDb()
      const db = useTenantDb()
      const chats = await db.prepare(`
        SELECT live_chats.id, COALESCE(live_chats.subject, live_chats.visitor_name) AS title, live_chats.last_message_at AS at,
          (SELECT author_name FROM live_chat_messages m WHERE m.chat_id = live_chats.id AND m.author_type = 'agent' AND m.author_name LIKE '%· Canopy Care' ORDER BY m.created_at DESC LIMIT 1) AS agent
        FROM live_chats WHERE care_handled = 1 AND last_message_at >= ? ORDER BY last_message_at DESC LIMIT 20
      `).all(since) as { id: string, title: string, at: string, agent: string | null }[]
      const tickets = await db.prepare(`
        SELECT tickets.id, tickets.subject AS title, MAX(ticket_replies.created_at) AS at, MAX(ticket_replies.author) AS agent
        FROM tickets JOIN ticket_replies ON ticket_replies.ticket_id = tickets.id AND ticket_replies.care_agent = 1 AND ticket_replies.internal = 0
        WHERE ticket_replies.created_at >= ? GROUP BY tickets.id, tickets.subject ORDER BY at DESC LIMIT 20
      `).all(since) as { id: string, title: string, at: string, agent: string | null }[]
      for (const [kind, rows] of [['chat', chats], ['ticket', tickets]] as const) {
        for (const row of rows) {
          if (!evaluated.has(`${engagement.orgId}:${kind}:${row.id}`))
            toReview.push({ orgId: engagement.orgId, orgName: engagement.orgName ?? engagement.orgId, engagementId: engagement.id, kind, id: row.id, title: row.title, agentName: (row.agent ?? '').replace(/ · Canopy Care$/, ''), at: row.at })
        }
      }
    })
  }

  const names = new Map(engagements.map(e => [e.orgId, e.orgName]))
  return {
    toReview: toReview.sort((a, b) => b.at.localeCompare(a.at)),
    evaluations: evaluations.map((e): CareEvaluation => ({ ...e, orgName: names.get(e.orgId) })),
    scorecards: Object.fromEntries(engagements.map(e => [e.id, e.scorecard])),
  }
})
