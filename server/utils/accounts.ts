import type { Account, AccountType } from '../../app/types/account'

export interface AccountRow {
  code: string
  name: string
  type: string
  parent_code: string | null
  is_active: number
  description: string | null
  created_at: string
  updated_at: string
}

export const CREDIT_NORMAL_TYPES: AccountType[] = ['liability', 'equity', 'revenue']

export function mapAccountRow(row: AccountRow, balance = 0): Account {
  return {
    code: row.code,
    name: row.name,
    type: row.type as AccountType,
    parentCode: row.parent_code ?? undefined,
    isActive: !!row.is_active,
    description: row.description ?? undefined,
    balance,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface BalanceDateRange {
  from?: string
  to?: string
}

/**
 * Sums every posted journal line for every account in one pass, oriented by each account's
 * normal balance side. With no range, this is the lifetime-to-date balance (Chart of Accounts).
 * A `to` alone gives a cumulative-as-of balance (Trial Balance, Balance Sheet); `from` + `to`
 * isolates a single period's flow (Income Statement) — accounts are never closed/reset in this
 * app, so a range query is how one period's activity gets separated from all the others.
 */
export async function getAccountBalances(range: BalanceDateRange = {}): Promise<Map<string, number>> {
  const db = useDatabase()

  // entry_date is stored as either a bare 'YYYY-MM-DD' (manual entries) or a full ISO timestamp
  // (auto-posted receipts) — comparing those two formats lexically as-is can wrongly include or
  // exclude same-day activity, so both sides are normalized to the calendar-day prefix here.
  const conditions: string[] = []
  const params: string[] = []
  if (range.from) {
    conditions.push('LEFT(journal_entries.entry_date, 10) >= ?')
    params.push(range.from.slice(0, 10))
  }
  if (range.to) {
    conditions.push('LEFT(journal_entries.entry_date, 10) <= ?')
    params.push(range.to.slice(0, 10))
  }
  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const rows = await db.prepare(`
    SELECT journal_entry_lines.account_code AS account_code, accounts.type AS type,
      SUM(journal_entry_lines.debit) AS total_debit, SUM(journal_entry_lines.credit) AS total_credit
    FROM journal_entry_lines
    JOIN accounts ON accounts.code = journal_entry_lines.account_code
    JOIN journal_entries ON journal_entries.id = journal_entry_lines.entry_id
    ${whereClause}
    GROUP BY journal_entry_lines.account_code, accounts.type
  `).all(...params) as { account_code: string, type: string, total_debit: number | string, total_credit: number | string }[]

  const balances = new Map<string, number>()
  for (const row of rows) {
    const debit = Number(row.total_debit)
    const credit = Number(row.total_credit)
    const balance = CREDIT_NORMAL_TYPES.includes(row.type as AccountType) ? credit - debit : debit - credit
    balances.set(row.account_code, balance)
  }
  return balances
}

export async function getAllAccounts(): Promise<Account[]> {
  const db = useDatabase()

  const rows = await db.prepare('SELECT * FROM accounts ORDER BY code ASC').all() as AccountRow[]
  const balances = await getAccountBalances()

  return rows.map(row => mapAccountRow(row, balances.get(row.code) ?? 0))
}

/** Same as getAllAccounts, but balances are scoped to a date range — the shared primitive behind every financial statement. */
export async function getAccountsWithBalances(range: BalanceDateRange = {}): Promise<Account[]> {
  const db = useDatabase()

  const rows = await db.prepare('SELECT * FROM accounts WHERE is_active = 1 ORDER BY code ASC').all() as AccountRow[]
  const balances = await getAccountBalances(range)

  return rows.map(row => mapAccountRow(row, balances.get(row.code) ?? 0))
}
