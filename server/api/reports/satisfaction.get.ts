/** Satisfaction survey results for the last 30 days (sent when a ticket is resolved). */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  await ensureDb()
  const since = new Date(Date.now() - 30 * 86400000).toISOString()
  const db = useTenantDb()
  const sent = await db.prepare('SELECT COUNT(*) AS count FROM ticket_surveys WHERE sent_at >= ?').get(since) as { count: string | number }
  const rows = await db.prepare(`
    SELECT ticket_surveys.rating, ticket_surveys.comment, ticket_surveys.responded_at, tickets.id AS ticket_id, tickets.subject
    FROM ticket_surveys JOIN tickets ON tickets.id = ticket_surveys.ticket_id
    WHERE ticket_surveys.responded_at >= ? ORDER BY ticket_surveys.responded_at DESC
  `).all(since) as { rating: number, comment: string | null, responded_at: string, ticket_id: string, subject: string }[]
  const distribution = [1, 2, 3, 4, 5].map(score => ({ score: String(score), count: rows.filter(r => Number(r.rating) === score).length }))
  return {
    sent: Number(sent.count),
    responses: rows.length,
    average: rows.length ? Math.round((rows.reduce((s, r) => s + Number(r.rating), 0) / rows.length) * 10) / 10 : null,
    distribution,
    recentComments: rows.filter(r => r.comment).slice(0, 5).map(r => ({ ticketId: r.ticket_id, subject: r.subject, rating: Number(r.rating), comment: r.comment!, at: r.responded_at })),
  }
})
