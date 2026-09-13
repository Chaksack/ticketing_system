export interface StatementLine {
  code: string
  name: string
  amount: number
}

export interface TrialBalanceReport {
  asOf: string
  lines: (StatementLine & { side: 'debit' | 'credit' })[]
  totalDebit: number
  totalCredit: number
}

export interface IncomeStatementReport {
  from: string
  to: string
  revenue: StatementLine[]
  expense: StatementLine[]
  totalRevenue: number
  totalExpense: number
  netIncome: number
}

export interface BalanceSheetReport {
  asOf: string
  assets: StatementLine[]
  liabilities: StatementLine[]
  equity: StatementLine[]
  netIncome: number
  totalAssets: number
  totalLiabilitiesAndEquity: number
  balanced: boolean
}
