import type { BalanceSheetReport, IncomeStatementReport, StatementLine, TrialBalanceReport } from '../../app/types/financial-statement'
import { CREDIT_NORMAL_TYPES, getAccountsWithBalances } from './accounts'

function toLines(accounts: { code: string, name: string, balance: number }[]): StatementLine[] {
  return accounts.map(account => ({ code: account.code, name: account.name, amount: account.balance }))
}

function sumBalances(accounts: { balance: number }[]) {
  return accounts.reduce((sum, account) => sum + account.balance, 0)
}

export async function buildTrialBalance(asOf: string): Promise<TrialBalanceReport> {
  const accounts = await getAccountsWithBalances({ to: asOf })

  let totalDebit = 0
  let totalCredit = 0
  const lines = accounts.map((account) => {
    const normalSide: 'debit' | 'credit' = CREDIT_NORMAL_TYPES.includes(account.type) ? 'credit' : 'debit'
    // A balance can sit on the "wrong" side of its account's normal side (e.g. cash gone
    // negative) — the side shown must follow the actual sign, not just the account's type.
    const side: 'debit' | 'credit' = account.balance >= 0 ? normalSide : normalSide === 'credit' ? 'debit' : 'credit'
    const amount = Math.abs(account.balance)
    if (side === 'credit')
      totalCredit += amount
    else
      totalDebit += amount
    return { code: account.code, name: account.name, amount, side }
  })

  return { asOf, lines, totalDebit, totalCredit }
}

/** Net income from inception through `asOf` — revenue/expense accounts are never closed in this app, so their lifetime-to-date balance already is their cumulative contribution to equity. */
async function netIncomeAsOf(asOf: string): Promise<number> {
  const accounts = await getAccountsWithBalances({ to: asOf })
  const revenue = accounts.filter(account => account.type === 'revenue')
  const expense = accounts.filter(account => account.type === 'expense')
  return sumBalances(revenue) - sumBalances(expense)
}

export async function buildIncomeStatement(from: string, to: string): Promise<IncomeStatementReport> {
  const accounts = await getAccountsWithBalances({ from, to })
  const revenueAccounts = accounts.filter(account => account.type === 'revenue')
  const expenseAccounts = accounts.filter(account => account.type === 'expense')

  const totalRevenue = sumBalances(revenueAccounts)
  const totalExpense = sumBalances(expenseAccounts)

  return {
    from,
    to,
    revenue: toLines(revenueAccounts),
    expense: toLines(expenseAccounts),
    totalRevenue,
    totalExpense,
    netIncome: totalRevenue - totalExpense,
  }
}

export async function buildBalanceSheet(asOf: string): Promise<BalanceSheetReport> {
  const accounts = await getAccountsWithBalances({ to: asOf })
  const assets = accounts.filter(account => account.type === 'asset')
  const liabilities = accounts.filter(account => account.type === 'liability')
  const equity = accounts.filter(account => account.type === 'equity')

  const netIncome = await netIncomeAsOf(asOf)
  const totalAssets = sumBalances(assets)
  const totalLiabilitiesAndEquity = sumBalances(liabilities) + sumBalances(equity) + netIncome

  return {
    asOf,
    assets: toLines(assets),
    liabilities: toLines(liabilities),
    equity: toLines(equity),
    netIncome,
    totalAssets,
    totalLiabilitiesAndEquity,
    balanced: Math.round(totalAssets * 100) === Math.round(totalLiabilitiesAndEquity * 100),
  }
}
