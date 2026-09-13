import type { AccountType } from '../../app/types/account'
import type { Budget, BudgetVsActualRow } from '../../app/types/budget'
import { getAccountBalances } from './accounts'
import { periodRangeFromId } from './fiscalPeriods'

export interface BudgetRow {
  id: string
  period_id: string
  account_code: string
  account_name?: string | null
  account_type?: string | null
  amount: number | string
  notes: string | null
  created_at: string
  updated_at: string
}

export function mapBudgetRow(row: BudgetRow): Budget {
  return {
    id: row.id,
    periodId: row.period_id,
    accountCode: row.account_code,
    accountName: row.account_name ?? row.account_code,
    amount: Number(row.amount),
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function getAllBudgets(periodId?: string): Promise<Budget[]> {
  const db = useDatabase()

  const rows = periodId
    ? await db.prepare(`
        SELECT budgets.*, accounts.name AS account_name
        FROM budgets
        LEFT JOIN accounts ON accounts.code = budgets.account_code
        WHERE budgets.period_id = ?
        ORDER BY budgets.account_code ASC
      `).all(periodId) as BudgetRow[]
    : await db.prepare(`
        SELECT budgets.*, accounts.name AS account_name
        FROM budgets
        LEFT JOIN accounts ON accounts.code = budgets.account_code
        ORDER BY budgets.period_id DESC, budgets.account_code ASC
      `).all() as BudgetRow[]

  return rows.map(mapBudgetRow)
}

/** Actual = the account's balance over the budget period's date range — same date-scoped primitive the financial statements use. */
export async function getBudgetVsActual(periodId: string): Promise<BudgetVsActualRow[]> {
  const db = useDatabase()

  const rows = await db.prepare(`
    SELECT budgets.*, accounts.name AS account_name, accounts.type AS account_type
    FROM budgets
    LEFT JOIN accounts ON accounts.code = budgets.account_code
    WHERE budgets.period_id = ?
    ORDER BY budgets.account_code ASC
  `).all(periodId) as BudgetRow[]

  if (!rows.length)
    return []

  const { startDate, endDate } = periodRangeFromId(periodId)
  const actuals = await getAccountBalances({ from: startDate, to: endDate })

  return rows.map((row) => {
    const budget = Number(row.amount)
    const actual = actuals.get(row.account_code) ?? 0
    const variance = actual - budget
    return {
      accountCode: row.account_code,
      accountName: row.account_name ?? row.account_code,
      type: (row.account_type ?? 'expense') as AccountType,
      budget,
      actual,
      variance,
      variancePct: budget !== 0 ? (variance / Math.abs(budget)) * 100 : null,
    }
  })
}
