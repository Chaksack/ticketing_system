import type { ExecutiveSummary } from '../../app/types/executive-summary'
import { LEAD_STAGE_PROBABILITY } from '../../app/types/lead'
import { TENDER_STAGE_PROBABILITY } from '../../app/types/tender'
import { getAccountBalances } from './accounts'
import { buildIncomeStatement } from './financialStatements'
import { getProjectProfitability, getResourceUtilization } from './timesheets'

interface ValueRow {
  stage: string
  estimated_value: string | number | null
}

interface DecidedRow {
  to_value: string
}

function pipelineTotals(rows: ValueRow[], probability: Record<string, number>) {
  let estimatedValueTotal = 0
  let weightedValueTotal = 0

  for (const row of rows) {
    if (row.stage === 'lost' || row.stage === 'won' || row.estimated_value === null)
      continue
    const value = Number(row.estimated_value)
    estimatedValueTotal += value
    weightedValueTotal += value * ((probability[row.stage] ?? 0) / 100)
  }

  return { estimatedValueTotal, weightedValueTotal }
}

function winRate(rows: DecidedRow[]) {
  const won = rows.filter(row => row.to_value === 'Won').length
  const lost = rows.filter(row => row.to_value === 'Lost').length
  const decided = won + lost
  return decided > 0 ? Math.round((won / decided) * 1000) / 10 : null
}

function mondayOfCurrentWeek() {
  const now = new Date()
  const day = now.getUTCDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diffToMonday))
}

export async function getExecutiveSummary(): Promise<ExecutiveSummary> {
  const db = useDatabase()

  // Support
  const openTicketsRow = await db.prepare(`SELECT COUNT(*) AS count FROM tickets WHERE status NOT IN ('resolved', 'closed')`).get() as { count: number }
  const overdueTicketsRow = await db.prepare(`
    SELECT COUNT(*) AS count FROM tickets
    WHERE status NOT IN ('resolved', 'closed') AND due_at IS NOT NULL AND due_at < ?
  `).get(new Date().toISOString()) as { count: number }

  // Sales — same pipeline-value/win-rate math already proven in server/api/bd-reports/summary.get.ts,
  // applied here to all-time open pipeline rather than a date range.
  const leadValueRows = await db.prepare('SELECT stage, estimated_value FROM leads').all() as ValueRow[]
  const tenderValueRows = await db.prepare('SELECT stage, estimated_value FROM tenders').all() as ValueRow[]
  const leadTotals = pipelineTotals(leadValueRows, LEAD_STAGE_PROBABILITY)
  const tenderTotals = pipelineTotals(tenderValueRows, TENDER_STAGE_PROBABILITY)

  const leadDecidedRows = await db.prepare(`SELECT to_value FROM lead_activity WHERE type = 'stage_changed' AND to_value IN ('Won', 'Lost')`).all() as DecidedRow[]
  const tenderDecidedRows = await db.prepare(`SELECT to_value FROM tender_activity WHERE type = 'stage_changed' AND to_value IN ('Won', 'Lost')`).all() as DecidedRow[]
  const combinedDecided = [...leadDecidedRows, ...tenderDecidedRows]

  const openQuotesRow = await db.prepare(`
    SELECT SUM(quote_line_items.unit_price * quote_line_items.quantity) AS total
    FROM quotes
    JOIN quote_line_items ON quote_line_items.quote_id = quotes.id
    WHERE quotes.status != 'invoiced'
  `).get() as { total: number | string | null }

  // Finance
  const balances = await getAccountBalances()
  const cash = balances.get('1010') ?? 0

  const arRow = await db.prepare('SELECT SUM(balance) AS total FROM invoices WHERE balance > 0').get() as { total: number | string | null }
  const apRow = await db.prepare('SELECT SUM(balance) AS total FROM vendor_bills WHERE balance > 0').get() as { total: number | string | null }

  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
  const incomeStatement = await buildIncomeStatement(monthStart, now.toISOString())

  // Projects
  const activeProjectsRow = await db.prepare(`SELECT COUNT(*) AS count FROM projects WHERE status = 'active'`).get() as { count: number }
  const profitabilityRows = await getProjectProfitability()
  const totalRevenue = profitabilityRows.reduce((sum, row) => sum + row.revenue, 0)
  const totalCost = profitabilityRows.reduce((sum, row) => sum + row.cost, 0)

  const monday = mondayOfCurrentWeek()
  const sunday = new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000)
  const utilizationRows = await getResourceUtilization(monday.toISOString().slice(0, 10), sunday.toISOString().slice(0, 10))
  const staffOverCapacity = utilizationRows.filter(row => row.status === 'over').length

  return {
    support: {
      openTickets: Number(openTicketsRow.count),
      overdueTickets: Number(overdueTicketsRow.count),
    },
    sales: {
      pipelineValue: leadTotals.estimatedValueTotal + tenderTotals.estimatedValueTotal,
      weightedPipelineValue: Math.round(leadTotals.weightedValueTotal + tenderTotals.weightedValueTotal),
      winRate: winRate(combinedDecided),
      openQuotesValue: Number(openQuotesRow.total ?? 0),
    },
    finance: {
      cash,
      accountsReceivable: Number(arRow.total ?? 0),
      accountsPayable: Number(apRow.total ?? 0),
      netIncome: incomeStatement.netIncome,
    },
    projects: {
      activeProjects: Number(activeProjectsRow.count),
      totalRevenue,
      totalCost,
      totalMargin: totalRevenue - totalCost,
      staffOverCapacity,
    },
  }
}
