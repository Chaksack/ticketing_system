import type { SalesDashboard } from '../../../app/types/salesDashboard'
import { LEAD_STAGE_PROBABILITY } from '../../../app/types/lead'
import { QUOTA_PERIOD_PATTERN } from '../../../app/types/quota'
import { TENDER_STAGE_PROBABILITY } from '../../../app/types/tender'

interface OpenRow { stage: string, estimated_value: string | number | null }
interface DecisionRow { outcome: 'Won' | 'Lost', decided_at: string, estimated_value: string | number | null }
interface EventRow { activity_type: string | null }

const DAY_MS = 24 * 60 * 60 * 1000
const OPEN_LEAD_STAGES = ['new', 'contacted', 'qualified', 'proposal'] as const

function isoParam(value: unknown, name: string) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value)))
    throw createError({ statusCode: 400, statusMessage: `${name} must be an ISO date-time` })
  return new Date(value).toISOString()
}

const amount = (value: string | number | null) => (value === null ? 0 : Number(value))

/**
 * Figures for the Sales dashboard (/overview). Date boundaries come from the browser so
 * "this month" and "today" follow the viewer's own calendar, not the server's.
 */
export default defineEventHandler(async (event): Promise<SalesDashboard> => {
  const user = await requireBd(event)
  await ensureDb()

  const query = getQuery(event)
  const from = isoParam(query.from, 'from')
  const to = isoParam(query.to, 'to')
  const trendFrom = isoParam(query.trendFrom, 'trendFrom')
  const todayFrom = isoParam(query.todayFrom, 'todayFrom')
  const todayTo = isoParam(query.todayTo, 'todayTo')
  const quotaPeriods = (typeof query.quotaPeriods === 'string' ? query.quotaPeriods.split(',') : []).filter(p => QUOTA_PERIOD_PATTERN.test(p)).slice(0, 12)

  const db = useTenantDb()

  const openLeads = await db.prepare(`SELECT stage, estimated_value FROM leads WHERE stage IN (${OPEN_LEAD_STAGES.map(() => '?').join(', ')})`).all(...OPEN_LEAD_STAGES) as OpenRow[]
  const openTenders = await db.prepare('SELECT stage, estimated_value FROM tenders WHERE stage NOT IN (\'won\', \'lost\')').all() as OpenRow[]

  const weighted = (rows: OpenRow[], probability: Record<string, number>) =>
    rows.reduce((sum, row) => sum + amount(row.estimated_value) * ((probability[row.stage] ?? 0) / 100), 0)

  const byStage: SalesDashboard['byStage'] = OPEN_LEAD_STAGES.map((stage) => {
    const rows = openLeads.filter(row => row.stage === stage)
    return { key: stage, count: rows.length, value: Math.round(rows.reduce((sum, row) => sum + amount(row.estimated_value), 0)) }
  })
  byStage.push({ key: 'tenders', count: openTenders.length, value: Math.round(openTenders.reduce((sum, row) => sum + amount(row.estimated_value), 0)) })

  // Won/lost decisions on leads and tenders since the earliest date any figure needs.
  const since = [trendFrom, from, new Date(Date.now() - 90 * DAY_MS).toISOString()].sort()[0]!
  const decisions: DecisionRow[] = []
  for (const kind of ['lead', 'tender'] as const) {
    decisions.push(...await db.prepare(`
      SELECT decisions.outcome AS outcome, decisions.decided_at AS decided_at, deals.estimated_value AS estimated_value
      FROM (${dealDecisionsSql(kind)}) AS decisions
      JOIN ${kind}s AS deals ON deals.id = decisions.deal_id
      WHERE decisions.decided_at >= ?
    `).all(since) as DecisionRow[])
  }

  const wonInPeriod = decisions.filter(d => d.outcome === 'Won' && d.decided_at >= from && d.decided_at <= to)

  const ninetyDaysAgo = new Date(Date.now() - 90 * DAY_MS).toISOString()
  const recent = decisions.filter(d => d.decided_at >= ninetyDaysAgo)
  const recentWon = recent.filter(d => d.outcome === 'Won').length

  const wonByMonth = new Map<string, number>()
  for (const d of decisions) {
    if (d.outcome === 'Won' && d.decided_at >= trendFrom)
      wonByMonth.set(d.decided_at.slice(0, 7), (wonByMonth.get(d.decided_at.slice(0, 7)) ?? 0) + amount(d.estimated_value))
  }

  let quotaTarget: number | null = null
  if (quotaPeriods.length) {
    const row = await db.prepare(`SELECT SUM(target_value) AS total FROM bd_quotas WHERE period IN (${quotaPeriods.map(() => '?').join(', ')})`).get(...quotaPeriods) as { total: string | number | null } | undefined
    quotaTarget = row?.total ? Number(row.total) : null
  }

  const todaysEvents = await db.prepare(`
    SELECT DISTINCT e.id, e.activity_type
    FROM calendar_events e
    LEFT JOIN calendar_event_attendees a ON a.event_id = e.id
    WHERE e.start_at >= ? AND e.start_at <= ? AND (e.created_by = ? OR a.staff_id = ?)
  `).all(todayFrom, todayTo, user.id, user.id) as EventRow[]
  const activityCounts = new Map<string, number>()
  for (const row of todaysEvents) {
    const type = row.activity_type?.trim() || 'Event'
    activityCounts.set(type, (activityCounts.get(type) ?? 0) + 1)
  }

  return {
    weightedPipeline: Math.round(weighted(openLeads, LEAD_STAGE_PROBABILITY) + weighted(openTenders, TENDER_STAGE_PROBABILITY)),
    openDeals: openLeads.length + openTenders.length,
    wonValue: Math.round(wonInPeriod.reduce((sum, d) => sum + amount(d.estimated_value), 0)),
    wonCount: wonInPeriod.length,
    quotaTarget,
    winRate: recent.length ? Math.round((recentWon / recent.length) * 100) : null,
    decidedLast90Days: recent.length,
    byStage,
    wonByMonth: [...wonByMonth].map(([month, value]) => ({ month, value: Math.round(value) })),
    activitiesToday: todaysEvents.length,
    activitiesByType: [...activityCounts].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
  }
})
