export interface BdReportSummary {
  range: { from: string, to: string }
  leads: {
    newCount: number
    convertedCount: number
    conversionRate: number
    byStage: { stage: string, count: number }[]
    bySource: { source: string, count: number }[]
    estimatedValueTotal: number
    weightedValueTotal: number
    wonCount: number
    lostCount: number
    winRate: number | null
    averageDealSize: number | null
    avgSalesCycleDays: number | null
  }
  tenders: {
    newCount: number
    convertedCount: number
    conversionRate: number
    byStage: { stage: string, count: number }[]
    bySource: { source: string, count: number }[]
    estimatedValueTotal: number
    weightedValueTotal: number
    wonCount: number
    lostCount: number
    winRate: number | null
    averageDealSize: number | null
    avgSalesCycleDays: number | null
  }
  clients: {
    newCount: number
    stageChanges: number
    byStage: { stage: string, count: number }[]
  }
  amc: {
    newContracts: number
    byStatus: { status: string, count: number }[]
    valueByCurrency: { currency: string, total: number }[]
  }
  tasks: {
    completedCount: number
  }
  projects: {
    newCount: number
    /** All projects right now, not just ones created in the range. */
    byStatus: { status: string, count: number }[]
  }
  trend: { date: string, leadsWon: number, tendersWon: number }[]
  /** Calendar activity (meetings, site visits…) by BD/SM staff or linked to a lead/tender/client. */
  calendar: {
    totalCount: number
    /** Already happened (ended before now). */
    completedCount: number
    /** Still ahead within the range. */
    scheduledCount: number
    /** Linked to a lead, tender or client. */
    linkedCount: number
    byType: { type: string, count: number }[]
    byRegarding: { regardingType: string, count: number }[]
    events: BdReportCalendarItem[]
    /** More events exist than the log lists. */
    truncated: boolean
  }
  interactions: {
    totalCount: number
    byType: { type: string, count: number }[]
  }
  quotes: {
    createdCount: number
    byStatus: { status: string, count: number, value: number }[]
    ordersByCurrency: { currency: string, count: number, total: number }[]
  }
  /** Payments received / costs incurred within the range, and what's still owed today. */
  projectFinancials: {
    currency: string
    paymentsReceived: number
    costsIncurred: number
    outstandingDue: number
    projectsWithBalance: number
  }[]
  reps: BdReportRepRow[]
  /** Always the next 14 days from today, regardless of the report range. */
  upcoming: {
    events: BdReportCalendarItem[]
    tenderDeadlines: { id: string, title: string, stage: string, submissionDeadline: string, estimatedValue?: number }[]
  }
  tasksOverdue: number
}

export interface BdReportCalendarItem {
  id: string
  title: string
  activityType: string
  startAt: string
  location?: string
  regardingType?: string
  regardingLabel?: string
  staff: string[]
}

export interface BdReportRepRow {
  staffId: string
  staffName: string
  newLeads: number
  newTenders: number
  dealsWon: number
  dealsLost: number
  wonValue: number
  calendarActivities: number
  interactionsLogged: number
  tasksCompleted: number
}
