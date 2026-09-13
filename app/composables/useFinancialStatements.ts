import type { BalanceSheetReport, IncomeStatementReport, TrialBalanceReport } from '~/types/financial-statement'

export function useFinancialStatements() {
  const trialBalance = useState<TrialBalanceReport | null>('trial-balance', () => null)
  const incomeStatement = useState<IncomeStatementReport | null>('income-statement', () => null)
  const balanceSheet = useState<BalanceSheetReport | null>('balance-sheet', () => null)

  async function fetchTrialBalance(asOf?: string) {
    trialBalance.value = await $fetch<TrialBalanceReport>('/api/reports/trial-balance', { query: asOf ? { asOf } : {} })
  }

  async function fetchIncomeStatement(from?: string, to?: string) {
    incomeStatement.value = await $fetch<IncomeStatementReport>('/api/reports/income-statement', { query: { from, to } })
  }

  async function fetchBalanceSheet(asOf?: string) {
    balanceSheet.value = await $fetch<BalanceSheetReport>('/api/reports/balance-sheet', { query: asOf ? { asOf } : {} })
  }

  return { trialBalance, incomeStatement, balanceSheet, fetchTrialBalance, fetchIncomeStatement, fetchBalanceSheet }
}
