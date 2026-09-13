export interface ExecutiveSummary {
  support: {
    openTickets: number
    overdueTickets: number
  }
  sales: {
    pipelineValue: number
    weightedPipelineValue: number
    winRate: number | null
    openQuotesValue: number
  }
  finance: {
    cash: number
    accountsReceivable: number
    accountsPayable: number
    netIncome: number
  }
  projects: {
    activeProjects: number
    totalRevenue: number
    totalCost: number
    totalMargin: number
    staffOverCapacity: number
  }
}
