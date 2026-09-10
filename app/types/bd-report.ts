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
  }
  tenders: {
    newCount: number
    convertedCount: number
    conversionRate: number
    byStage: { stage: string, count: number }[]
    bySource: { source: string, count: number }[]
    estimatedValueTotal: number
    weightedValueTotal: number
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
  }
}
