import type { AmcContract } from './amc'

export type ProjectStatus = 'planned' | 'active' | 'on_hold' | 'completed' | 'cancelled'

/** Rough visual progress per status — not a precise measure, just enough for a progress bar. */
export const PROJECT_STATUS_PROGRESS: Record<ProjectStatus, number> = {
  planned: 10,
  active: 55,
  on_hold: 55,
  completed: 100,
  cancelled: 0,
}

/** Currencies a project's value, costs and payments can be recorded in. */
export const PROJECT_CURRENCIES = [
  { code: 'GHS', label: 'Ghana Cedi', symbol: 'GH₵' },
  { code: 'USD', label: 'US Dollar', symbol: '$' },
] as const

export type ProjectCurrency = typeof PROJECT_CURRENCIES[number]['code']

export const DEFAULT_PROJECT_CURRENCY: ProjectCurrency = 'GHS'

export function isProjectCurrency(value: unknown): value is ProjectCurrency {
  return PROJECT_CURRENCIES.some(c => c.code === value)
}

/** "GH₵ 25,000.00" / "$ 25,000.00" — falls back to the raw code for anything unexpected. */
export function formatProjectMoney(currency: string, value: number, fractionDigits = 2) {
  const symbol = PROJECT_CURRENCIES.find(c => c.code === currency)?.symbol ?? currency
  return `${symbol} ${value.toLocaleString(undefined, { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })}`
}

export type ProjectFinancialEntryKind = 'cost' | 'payment'

/** A cost incurred on the project, or a payment received from the client. */
export interface ProjectFinancialEntry {
  id: string
  projectId: string
  kind: ProjectFinancialEntryKind
  description?: string
  amount: number
  entryDate: string
  reference?: string
  recordedBy?: string
  recordedByName?: string
  createdAt: string
}

export interface Project {
  id: string
  clientId: string
  clientName?: string
  name: string
  description?: string
  status: ProjectStatus
  startDate?: string
  endDate?: string
  erpProjectId?: string
  createdBy?: string
  createdAt: string
  updatedAt: string
  contracts: AmcContract[]
  taskCount: number
  currency: string
  /** What the client pays for the project. Margin and amount due need this set. */
  contractValue?: number
  totalCost: number
  amountPaid: number
  /** contractValue − totalCost */
  margin?: number
  /** margin as a % of contractValue */
  marginPct?: number
  /** contractValue − amountPaid (negative = overpaid) */
  amountDue?: number
  /** Only populated when loading a single project. */
  financialEntries: ProjectFinancialEntry[]
}
