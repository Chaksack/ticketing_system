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
  projects: {
    activeProjects: number
    staffOverCapacity: number
  }
}
