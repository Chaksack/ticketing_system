const AUTO_CLOSE_AFTER_MS = 72 * 60 * 60 * 1000

interface SweepTicketRow {
  id: string
  status: string
  due_at: string | null
  resolved_at: string | null
  sla_escalated: number
  escalation_level: string | null
}

export async function escalateBreachedSla() {
  const db = useDatabase()
  const now = new Date().toISOString()

  const breached = await db.prepare(`
    SELECT id, status, due_at, resolved_at, sla_escalated, escalation_level FROM tickets
    WHERE status IN ('open', 'in-progress') AND sla_escalated = 0 AND due_at IS NOT NULL AND due_at < ?
  `).all(now) as SweepTicketRow[]

  for (const row of breached) {
    const ticket = await loadFullTicket(row.id)
    await pageOnCallForTicket(ticket)
    await db.prepare('UPDATE tickets SET sla_escalated = 1 WHERE id = ?').run(row.id)
    await logTicketActivity({
      ticketId: row.id,
      type: 'sla_escalated',
      actorName: 'System',
      message: 'SLA breached — on-call staff paged',
    })

    if (!row.escalation_level) {
      await escalateTicket(row.id, { name: 'System' })
    }
  }

  return breached.length
}

export async function autoCloseInactiveTickets() {
  const db = useDatabase()
  const cutoff = new Date(Date.now() - AUTO_CLOSE_AFTER_MS).toISOString()
  const now = new Date().toISOString()

  const inactive = await db.prepare(`
    SELECT id FROM tickets WHERE status = 'resolved' AND resolved_at IS NOT NULL AND resolved_at < ?
  `).all(cutoff) as { id: string }[]

  for (const row of inactive) {
    await db.prepare('UPDATE tickets SET status = \'closed\', closed_at = ?, updated_at = ? WHERE id = ?').run(now, now, row.id)
    await logTicketActivity({
      ticketId: row.id,
      type: 'status_changed',
      actorName: 'System',
      fromValue: 'Resolved',
      toValue: 'Closed',
      message: 'Auto-closed after 72 hours of inactivity',
    })
  }

  return inactive.length
}

export async function runTicketSweep() {
  await ensureDb()
  const [escalated, closed] = await Promise.all([
    escalateBreachedSla(),
    autoCloseInactiveTickets(),
  ])
  await pruneRateLimitCounters()
  return { escalated, closed }
}
