import type { FiscalPeriod } from '../../app/types/fiscal-period'

export interface FiscalPeriodRow {
  id: string
  label: string
  start_date: string
  end_date: string
  status: string
  created_at: string
}

export function mapFiscalPeriodRow(row: FiscalPeriodRow): FiscalPeriod {
  return {
    id: row.id,
    label: row.label,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status as FiscalPeriod['status'],
    createdAt: row.created_at,
  }
}

function monthKey(dateIso: string) {
  return dateIso.slice(0, 7)
}

function monthLabel(key: string) {
  const [year, month] = key.split('-').map(Number)
  return new Date(Date.UTC(year!, month! - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/** Pure month-boundary math for a 'YYYY-MM' id — used both to create a fiscal period row and, for Budgeting, to compute a period's date range without requiring one to exist yet. */
export function periodRangeFromId(id: string) {
  const [year, month] = id.split('-').map(Number)
  const startDate = new Date(Date.UTC(year!, month! - 1, 1)).toISOString()
  const endDate = new Date(Date.UTC(year!, month!, 0, 23, 59, 59, 999)).toISOString()
  return { startDate, endDate, label: monthLabel(id) }
}

/**
 * Resolves (auto-creating if needed, defaulting to 'open') the fiscal period covering the given
 * date, and throws if that period already exists and is closed. Journal entries always post
 * through this so posting-into-a-closed-period is enforced in exactly one place.
 */
export async function resolveOpenPeriodForDate(dateIso: string): Promise<FiscalPeriod> {
  const db = useDatabase()
  const id = monthKey(dateIso)

  const existing = await db.prepare('SELECT * FROM fiscal_periods WHERE id = ?').get(id) as FiscalPeriodRow | undefined
  if (existing) {
    if (existing.status === 'closed') {
      throw createError({ statusCode: 400, statusMessage: `Fiscal period ${existing.label} is closed` })
    }
    return mapFiscalPeriodRow(existing)
  }

  const { startDate, endDate, label } = periodRangeFromId(id)
  const now = new Date().toISOString()

  await db.prepare(`
    INSERT INTO fiscal_periods (id, label, start_date, end_date, status, created_at)
    VALUES (?, ?, ?, ?, 'open', ?)
  `).run(id, label, startDate, endDate, now)

  return { id, label, startDate, endDate, status: 'open', createdAt: now }
}
