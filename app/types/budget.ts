import type { AccountType } from './account'

export interface Budget {
  id: string
  periodId: string
  accountCode: string
  accountName: string
  amount: number
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface BudgetVsActualRow {
  accountCode: string
  accountName: string
  type: AccountType
  budget: number
  actual: number
  variance: number
  variancePct: number | null
}
