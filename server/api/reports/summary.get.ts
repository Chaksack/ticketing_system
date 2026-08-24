interface ReportTicketRow {
  id: string
  status: string
  priority: string
  category: string
  created_at: string
  resolved_at: string | null
  due_at: string | null
  first_response_at: string | null
  assignee_id: string | null
}

const DAY_MS = 24 * 60 * 60 * 1000
const VOLUME_WINDOW_DAYS = 30

function dayKey(iso: string) {
  return iso.slice(0, 10)
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  await ensureDb()

  const db = useDatabase()
  const tickets = await db.prepare(`
    SELECT id, status, priority, category, created_at, resolved_at, due_at, first_response_at, assignee_id
    FROM tickets
  `).all() as ReportTicketRow[]

  const staff = await db.prepare('SELECT id, name FROM staff').all() as { id: string, name: string }[]
  const staffNameById = new Map(staff.map(s => [s.id, s.name]))

  const byStatus: Record<string, number> = {}
  const byPriority: Record<string, number> = {}
  const byCategory: Record<string, number> = {}

  const windowStart = Date.now() - VOLUME_WINDOW_DAYS * DAY_MS
  const createdByDay = new Map<string, number>()
  const resolvedByDay = new Map<string, number>()

  let resolvedInWindowCount = 0
  let slaCompliantCount = 0

  let firstResponseTotalMins = 0
  let firstResponseCount = 0
  let resolutionTotalMins = 0
  let resolutionCount = 0

  interface AgentStats { name: string, resolvedCount: number, resolutionTotalMins: number }
  const agentStats = new Map<string, AgentStats>()

  for (const ticket of tickets) {
    byStatus[ticket.status] = (byStatus[ticket.status] ?? 0) + 1
    byPriority[ticket.priority] = (byPriority[ticket.priority] ?? 0) + 1
    byCategory[ticket.category] = (byCategory[ticket.category] ?? 0) + 1

    const createdAt = new Date(ticket.created_at).getTime()
    if (createdAt >= windowStart) {
      const key = dayKey(ticket.created_at)
      createdByDay.set(key, (createdByDay.get(key) ?? 0) + 1)
    }

    if (ticket.first_response_at) {
      firstResponseTotalMins += (new Date(ticket.first_response_at).getTime() - createdAt) / 60_000
      firstResponseCount++
    }

    if (ticket.resolved_at) {
      const resolvedAt = new Date(ticket.resolved_at).getTime()
      const resolutionMins = (resolvedAt - createdAt) / 60_000
      resolutionTotalMins += resolutionMins
      resolutionCount++

      if (resolvedAt >= windowStart) {
        const key = dayKey(ticket.resolved_at)
        resolvedByDay.set(key, (resolvedByDay.get(key) ?? 0) + 1)
        resolvedInWindowCount++

        if (ticket.due_at && resolvedAt <= new Date(ticket.due_at).getTime())
          slaCompliantCount++
      }

      if (ticket.assignee_id) {
        const name = staffNameById.get(ticket.assignee_id) ?? 'Unknown'
        const stats = agentStats.get(ticket.assignee_id) ?? { name, resolvedCount: 0, resolutionTotalMins: 0 }
        stats.resolvedCount++
        stats.resolutionTotalMins += resolutionMins
        agentStats.set(ticket.assignee_id, stats)
      }
    }
  }

  const volume: { date: string, created: number, resolved: number }[] = []
  for (let i = VOLUME_WINDOW_DAYS - 1; i >= 0; i--) {
    const date = dayKey(new Date(Date.now() - i * DAY_MS).toISOString())
    volume.push({ date, created: createdByDay.get(date) ?? 0, resolved: resolvedByDay.get(date) ?? 0 })
  }

  const agents = [...agentStats.entries()].map(([assigneeId, stats]) => ({
    assigneeId,
    name: stats.name,
    resolvedCount: stats.resolvedCount,
    avgResolutionMins: Math.round(stats.resolutionTotalMins / stats.resolvedCount),
  })).sort((a, b) => b.resolvedCount - a.resolvedCount)

  return {
    totalTickets: tickets.length,
    byStatus,
    byPriority,
    byCategory,
    volume,
    slaCompliance: {
      resolvedInWindow: resolvedInWindowCount,
      compliant: slaCompliantCount,
      rate: resolvedInWindowCount ? Math.round((slaCompliantCount / resolvedInWindowCount) * 100) : null,
    },
    avgFirstResponseMins: firstResponseCount ? Math.round(firstResponseTotalMins / firstResponseCount) : null,
    avgResolutionMins: resolutionCount ? Math.round(resolutionTotalMins / resolutionCount) : null,
    agents,
  }
})
