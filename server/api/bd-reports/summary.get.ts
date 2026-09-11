import { LEAD_STAGE_PROBABILITY } from '../../../app/types/lead'
import { TENDER_STAGE_PROBABILITY } from '../../../app/types/tender'

interface CountRow { count: string | number }
interface GroupCountRow { key: string, count: string | number }
interface CurrencyTotalRow { currency: string, total: string | number }
interface ValueRow { stage: string, estimated_value: string | number | null }
interface DecidedRow { to_value: string, decided_at: string, created_at: string, estimated_value: string | number | null }

const DAY_MS = 24 * 60 * 60 * 1000

function dayKey(iso: string) {
  return iso.slice(0, 10)
}

function computeValueTotals(rows: ValueRow[], probability: Record<string, number>) {
  let estimatedValueTotal = 0
  let weightedValueTotal = 0

  for (const row of rows) {
    if (row.stage === 'lost' || row.estimated_value === null)
      continue

    const value = Number(row.estimated_value)
    estimatedValueTotal += value
    weightedValueTotal += value * ((probability[row.stage] ?? 0) / 100)
  }

  return {
    estimatedValueTotal: Math.round(estimatedValueTotal),
    weightedValueTotal: Math.round(weightedValueTotal),
  }
}

function computeWinLossStats(rows: DecidedRow[]) {
  const wonRows = rows.filter(row => row.to_value === 'Won')
  const lostRows = rows.filter(row => row.to_value === 'Lost')
  const decidedCount = wonRows.length + lostRows.length

  const dealSizes = wonRows.map(row => row.estimated_value).filter((v): v is string | number => v !== null).map(Number)
  const cycleDays = wonRows.map(row => (new Date(row.decided_at).getTime() - new Date(row.created_at).getTime()) / DAY_MS)

  return {
    wonCount: wonRows.length,
    lostCount: lostRows.length,
    winRate: decidedCount > 0 ? Math.round((wonRows.length / decidedCount) * 1000) / 10 : null,
    averageDealSize: dealSizes.length ? Math.round(dealSizes.reduce((a, b) => a + b, 0) / dealSizes.length) : null,
    avgSalesCycleDays: cycleDays.length ? Math.round((cycleDays.reduce((a, b) => a + b, 0) / cycleDays.length) * 10) / 10 : null,
    wonRows,
  }
}

export default defineEventHandler(async (event) => {
  await requireBd(event)
  await ensureDb()

  const query = getQuery(event)
  const fromDate = typeof query.from === 'string' && query.from ? query.from : null
  const toDate = typeof query.to === 'string' && query.to ? query.to : null

  const now = new Date()
  const defaultTo = now.toISOString().slice(0, 10)
  const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const from = `${fromDate ?? defaultFrom}T00:00:00.000Z`
  const to = `${toDate ?? defaultTo}T23:59:59.999Z`

  const db = useDatabase()

  const newLeadsRow = await db.prepare('SELECT COUNT(*) as count FROM leads WHERE created_at BETWEEN ? AND ?').get(from, to) as CountRow
  const convertedLeadsRow = await db.prepare('SELECT COUNT(DISTINCT lead_id) as count FROM lead_activity WHERE type = \'converted\' AND created_at BETWEEN ? AND ?').get(from, to) as CountRow
  const leadsByStage = await db.prepare('SELECT stage as key, COUNT(*) as count FROM leads WHERE created_at BETWEEN ? AND ? GROUP BY stage').all(from, to) as GroupCountRow[]
  const leadsBySource = await db.prepare('SELECT COALESCE(NULLIF(source, \'\'), \'Unknown\') as key, COUNT(*) as count FROM leads WHERE created_at BETWEEN ? AND ? GROUP BY COALESCE(NULLIF(source, \'\'), \'Unknown\')').all(from, to) as GroupCountRow[]
  const leadValueRows = await db.prepare('SELECT stage, estimated_value FROM leads WHERE created_at BETWEEN ? AND ?').all(from, to) as ValueRow[]
  const leadDecidedRows = await db.prepare(`
    SELECT lead_activity.to_value AS to_value, lead_activity.created_at AS decided_at, leads.created_at AS created_at, leads.estimated_value AS estimated_value
    FROM lead_activity
    JOIN leads ON leads.id = lead_activity.lead_id
    WHERE lead_activity.type = 'stage_changed' AND lead_activity.to_value IN ('Won', 'Lost')
      AND lead_activity.created_at BETWEEN ? AND ?
  `).all(from, to) as DecidedRow[]

  const newTendersRow = await db.prepare('SELECT COUNT(*) as count FROM tenders WHERE created_at BETWEEN ? AND ?').get(from, to) as CountRow
  const convertedTendersRow = await db.prepare('SELECT COUNT(DISTINCT tender_id) as count FROM tender_activity WHERE type = \'converted\' AND created_at BETWEEN ? AND ?').get(from, to) as CountRow
  const tendersByStage = await db.prepare('SELECT stage as key, COUNT(*) as count FROM tenders WHERE created_at BETWEEN ? AND ? GROUP BY stage').all(from, to) as GroupCountRow[]
  const tendersBySource = await db.prepare('SELECT COALESCE(NULLIF(source, \'\'), \'Unknown\') as key, COUNT(*) as count FROM tenders WHERE created_at BETWEEN ? AND ? GROUP BY COALESCE(NULLIF(source, \'\'), \'Unknown\')').all(from, to) as GroupCountRow[]
  const tenderValueRows = await db.prepare('SELECT stage, estimated_value FROM tenders WHERE created_at BETWEEN ? AND ?').all(from, to) as ValueRow[]
  const tenderDecidedRows = await db.prepare(`
    SELECT tender_activity.to_value AS to_value, tender_activity.created_at AS decided_at, tenders.created_at AS created_at, tenders.estimated_value AS estimated_value
    FROM tender_activity
    JOIN tenders ON tenders.id = tender_activity.tender_id
    WHERE tender_activity.type = 'stage_changed' AND tender_activity.to_value IN ('Won', 'Lost')
      AND tender_activity.created_at BETWEEN ? AND ?
  `).all(from, to) as DecidedRow[]

  const newClientsRow = await db.prepare('SELECT COUNT(*) as count FROM clients WHERE created_at BETWEEN ? AND ?').get(from, to) as CountRow
  const clientsByStage = await db.prepare('SELECT stage as key, COUNT(*) as count FROM clients WHERE created_at BETWEEN ? AND ? GROUP BY stage').all(from, to) as GroupCountRow[]
  const stageChangesRow = await db.prepare('SELECT COUNT(*) as count FROM client_activity WHERE type = \'stage_changed\' AND created_at BETWEEN ? AND ?').get(from, to) as CountRow

  const newContractsRow = await db.prepare('SELECT COUNT(*) as count FROM client_amc_contracts WHERE created_at BETWEEN ? AND ?').get(from, to) as CountRow
  const contractsByStatus = await db.prepare('SELECT status as key, COUNT(*) as count FROM client_amc_contracts WHERE created_at BETWEEN ? AND ? GROUP BY status').all(from, to) as GroupCountRow[]
  const valueByCurrency = await db.prepare(`
    SELECT amc_plans.currency as currency, SUM(COALESCE(amc_plans.price, 0)) as total
    FROM client_amc_contracts
    JOIN amc_plans ON amc_plans.id = client_amc_contracts.plan_id
    WHERE client_amc_contracts.created_at BETWEEN ? AND ?
    GROUP BY amc_plans.currency
  `).all(from, to) as CurrencyTotalRow[]

  const completedTasksRow = await db.prepare('SELECT COUNT(*) as count FROM tasks WHERE status = \'done\' AND updated_at BETWEEN ? AND ?').get(from, to) as CountRow

  const newProjectsRow = await db.prepare('SELECT COUNT(*) as count FROM projects WHERE created_at BETWEEN ? AND ?').get(from, to) as CountRow

  const newLeads = Number(newLeadsRow.count)
  const convertedLeads = Number(convertedLeadsRow.count)
  const newTenders = Number(newTendersRow.count)
  const convertedTenders = Number(convertedTendersRow.count)

  const leadWinLoss = computeWinLossStats(leadDecidedRows)
  const tenderWinLoss = computeWinLossStats(tenderDecidedRows)

  const leadsWonByDay = new Map<string, number>()
  for (const row of leadWinLoss.wonRows)
    leadsWonByDay.set(dayKey(row.decided_at), (leadsWonByDay.get(dayKey(row.decided_at)) ?? 0) + 1)

  const tendersWonByDay = new Map<string, number>()
  for (const row of tenderWinLoss.wonRows)
    tendersWonByDay.set(dayKey(row.decided_at), (tendersWonByDay.get(dayKey(row.decided_at)) ?? 0) + 1)

  const trend: { date: string, leadsWon: number, tendersWon: number }[] = []
  const rangeStart = new Date(`${fromDate ?? defaultFrom}T00:00:00.000Z`)
  const rangeEnd = new Date(`${toDate ?? defaultTo}T00:00:00.000Z`)
  for (let day = rangeStart; day <= rangeEnd; day = new Date(day.getTime() + DAY_MS)) {
    const key = dayKey(day.toISOString())
    trend.push({ date: key, leadsWon: leadsWonByDay.get(key) ?? 0, tendersWon: tendersWonByDay.get(key) ?? 0 })
  }

  return {
    range: { from: fromDate ?? defaultFrom, to: toDate ?? defaultTo },
    leads: {
      newCount: newLeads,
      convertedCount: convertedLeads,
      conversionRate: newLeads > 0 ? Math.round((convertedLeads / newLeads) * 1000) / 10 : 0,
      byStage: leadsByStage.map(row => ({ stage: row.key, count: Number(row.count) })),
      bySource: leadsBySource.map(row => ({ source: row.key, count: Number(row.count) })),
      ...computeValueTotals(leadValueRows, LEAD_STAGE_PROBABILITY),
      wonCount: leadWinLoss.wonCount,
      lostCount: leadWinLoss.lostCount,
      winRate: leadWinLoss.winRate,
      averageDealSize: leadWinLoss.averageDealSize,
      avgSalesCycleDays: leadWinLoss.avgSalesCycleDays,
    },
    tenders: {
      newCount: newTenders,
      convertedCount: convertedTenders,
      conversionRate: newTenders > 0 ? Math.round((convertedTenders / newTenders) * 1000) / 10 : 0,
      byStage: tendersByStage.map(row => ({ stage: row.key, count: Number(row.count) })),
      bySource: tendersBySource.map(row => ({ source: row.key, count: Number(row.count) })),
      ...computeValueTotals(tenderValueRows, TENDER_STAGE_PROBABILITY),
      wonCount: tenderWinLoss.wonCount,
      lostCount: tenderWinLoss.lostCount,
      winRate: tenderWinLoss.winRate,
      averageDealSize: tenderWinLoss.averageDealSize,
      avgSalesCycleDays: tenderWinLoss.avgSalesCycleDays,
    },
    clients: {
      newCount: Number(newClientsRow.count),
      stageChanges: Number(stageChangesRow.count),
      byStage: clientsByStage.map(row => ({ stage: row.key, count: Number(row.count) })),
    },
    amc: {
      newContracts: Number(newContractsRow.count),
      byStatus: contractsByStatus.map(row => ({ status: row.key, count: Number(row.count) })),
      valueByCurrency: valueByCurrency.map(row => ({ currency: row.currency, total: Number(row.total) })),
    },
    tasks: {
      completedCount: Number(completedTasksRow.count),
    },
    projects: {
      newCount: Number(newProjectsRow.count),
    },
    trend,
  }
})
