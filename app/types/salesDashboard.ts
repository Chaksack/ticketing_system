/** Response of GET /api/bd-reports/pipeline — the Sales dashboard on /overview. */
export interface SalesDashboard {
  /** Open leads and tenders, each estimate × its stage's win probability. */
  weightedPipeline: number
  openDeals: number
  /** Leads and tenders won in the selected period. */
  wonValue: number
  wonCount: number
  /** Sum of every BD quota set for the period, or null when none are set. */
  quotaTarget: number | null
  /** Won ÷ decided (won + lost) over the last 90 days, as a whole percent. */
  winRate: number | null
  decidedLast90Days: number
  /** Open lead stages (new/contacted/qualified/proposal) plus one "tenders" row. */
  byStage: { key: string, count: number, value: number }[]
  /** Won value per YYYY-MM, from `trendFrom` on; months with nothing won are left out. */
  wonByMonth: { month: string, value: number }[]
  /** Calendar events today that the viewer created or is attending. */
  activitiesToday: number
  activitiesByType: { type: string, count: number }[]
}
