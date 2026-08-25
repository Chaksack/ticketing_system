export interface ReportSummary {
  totalTickets: number
  byStatus: Record<string, number>
  byPriority: Record<string, number>
  byCategory: Record<string, number>
  volume: { date: string, created: number, resolved: number }[]
  slaBreachVolume: { date: string, breached: number }[]
  slaCompliance: { resolvedInWindow: number, compliant: number, breached: number, openOverdue: number, rate: number | null }
  avgFirstResponseMins: number | null
  avgResolutionMins: number | null
  agents: { assigneeId: string, name: string, resolvedCount: number, avgResolutionMins: number }[]
}

export function useReports() {
  const summary = useState<ReportSummary | null>('reports-summary', () => null)
  const pending = useState('reports-summary-pending', () => false)

  async function fetchSummary() {
    pending.value = true
    try {
      summary.value = await $fetch<ReportSummary>('/api/reports/summary')
    }
    finally {
      pending.value = false
    }
  }

  return { summary, pending, fetchSummary }
}
