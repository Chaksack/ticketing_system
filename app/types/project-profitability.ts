export interface ProjectProfitabilityRow {
  projectId: string
  projectName: string
  revenue: number
  cost: number
  margin: number
  marginPct: number | null
}
