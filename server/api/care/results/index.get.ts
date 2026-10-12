/**
 * The client's own view of Canopy Care (Admin → Canopy Care results), month to date, computed
 * from their workspace: conversations handled, service level, first-contact resolution, CSAT,
 * quality (evaluations Canopy chose to share) and top contact reasons.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const engagement = await engagementForOrg(currentOrgId())
  if (!engagement)
    return { engagement: null }
  await ensureDb()
  const db = useTenantDb()
  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()

  const chats = await db.prepare('SELECT started_at, first_response_at, ticket_id FROM live_chats WHERE care_handled = 1 AND started_at >= ?').all(monthStart) as { started_at: string, first_response_at: string | null, ticket_id: string | null }[]
  const ticketIds = (await db.prepare('SELECT DISTINCT ticket_id FROM ticket_replies WHERE care_agent = 1 AND internal = 0 AND created_at >= ?').all(monthStart) as { ticket_id: string }[]).map(r => r.ticket_id)
  const tickets = ticketIds.length
    ? await db.prepare(`SELECT id, category, status, (SELECT COUNT(*) FROM ticket_replies r WHERE r.ticket_id = tickets.id AND r.author_type = 'staff' AND r.internal = 0) AS staff_replies FROM tickets WHERE id IN (${ticketIds.map(() => '?').join(', ')})`).all(...ticketIds) as { id: string, category: string, status: string, staff_replies: string | number }[]
    : []

  const answered = chats.filter(c => c.first_response_at)
  const withinTarget = answered.filter(c => (new Date(c.first_response_at!).getTime() - new Date(c.started_at).getTime()) / 1000 <= engagement.replyTargetSeconds)
  const resolved = tickets.filter(t => t.status === 'resolved' || t.status === 'closed')
  const firstContact = resolved.filter(t => Number(t.staff_replies) <= 1)
  const surveys = await db.prepare('SELECT rating FROM ticket_surveys WHERE rating IS NOT NULL AND responded_at >= ?').all(monthStart) as { rating: number }[]

  await ensureCareTables()
  const evaluations = await useControlDb().prepare('SELECT score FROM cp_care_evaluations WHERE org_id = ? AND shared = 1 AND created_at >= ?').all(currentOrgId(), monthStart) as { score: number }[]

  const reasons = new Map<string, number>()
  for (const t of tickets)
    reasons.set(t.category, (reasons.get(t.category) ?? 0) + 1)
  if (chats.length)
    reasons.set('Live chat questions', (reasons.get('Live chat questions') ?? 0) + chats.filter(c => !c.ticket_id).length)
  const reasonTotal = [...reasons.values()].reduce((a, b) => a + b, 0)

  return {
    engagement: { stage: engagement.stage, model: engagement.model, agents: engagement.agentIds.length, slaText: engagement.slaText, recommendations: engagement.recommendations },
    month: now.toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    handled: chats.length + tickets.length,
    serviceLevel: answered.length ? Math.round((withinTarget.length / answered.length) * 100) : null,
    firstContactResolution: resolved.length ? Math.round((firstContact.length / resolved.length) * 100) : null,
    csat: surveys.length ? Math.round((surveys.reduce((s, r) => s + Number(r.rating), 0) / surveys.length) * 10) / 10 : null,
    csatResponses: surveys.length,
    quality: evaluations.length ? Math.round(evaluations.reduce((s, e) => s + Number(e.score), 0) / evaluations.length) : null,
    qualityEvaluations: evaluations.length,
    reasons: [...reasons].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, count]) => ({ label, percent: reasonTotal ? Math.round((count / reasonTotal) * 100) : 0 })),
  }
})
