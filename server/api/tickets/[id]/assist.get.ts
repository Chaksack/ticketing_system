/**
 * Context for the agent workspace's Assist card: earlier resolved tickets that look like this one,
 * with how they were resolved (the "Resolution" note written when they were closed).
 */
export default defineEventHandler(async (event) => {
  await requireServiceStaff(event)
  const id = getRouterParam(event, 'id') ?? ''
  await ensureDb()
  const db = useTenantDb()

  const ticket = await db.prepare('SELECT subject, description FROM tickets WHERE id = ?').get(id) as { subject: string, description: string } | undefined
  if (!ticket)
    throw createError({ statusCode: 404, statusMessage: 'Ticket not found' })

  const terms = searchTerms(`${ticket.subject} ${ticket.subject} ${ticket.description}`).slice(0, 10)
  if (!terms.length)
    return { similar: [] }

  const resolved = await db.prepare(`SELECT id, subject, description, resolved_at FROM tickets WHERE id <> ? AND status IN ('resolved', 'closed') ORDER BY resolved_at DESC LIMIT 400`).all(id) as { id: string, subject: string, description: string, resolved_at: string | null }[]
  const scored = resolved
    .map(row => ({ row, score: terms.reduce((sum, term) => sum + (row.subject.toLowerCase().includes(term) ? 3 : 0) + (row.description.toLowerCase().includes(term) ? 1 : 0), 0) }))
    .filter(r => r.score >= Math.min(3, terms.length))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  const similar = []
  for (const { row } of scored) {
    const note = await db.prepare(`SELECT message FROM ticket_replies WHERE ticket_id = ? AND internal = 1 AND message LIKE 'Resolution%' ORDER BY created_at DESC LIMIT 1`).get(row.id) as { message: string } | undefined
    const lastReply = note ?? await db.prepare('SELECT message FROM ticket_replies WHERE ticket_id = ? AND author_type = \'staff\' AND internal = 0 ORDER BY created_at DESC LIMIT 1').get(row.id) as { message: string } | undefined
    similar.push({ id: row.id, subject: row.subject, resolvedAt: row.resolved_at ?? undefined, resolution: lastReply?.message.slice(0, 280) })
  }
  return { similar }
})
