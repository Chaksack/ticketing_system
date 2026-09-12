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

const CREDIT_NORMAL_TYPES: AccountType[] = ['liability', 'equity', 'revenue']

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

/** Sums every posted journal line for every account in one pass, oriented by each account's normal balance side. */
export async function getAccountBalances(): Promise<Map<string, number>> {
  const db = useDatabase()

  const rows = await db.prepare(`
    SELECT journal_entry_lines.account_code AS account_code, accounts.type AS type,
      SUM(journal_entry_lines.debit) AS total_debit, SUM(journal_entry_lines.credit) AS total_credit
    FROM journal_entry_lines
    JOIN accounts ON accounts.code = journal_entry_lines.account_code
    GROUP BY journal_entry_lines.account_code, accounts.type
  `).all() as { account_code: string, type: string, total_debit: number | string, total_credit: number | string }[]

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
