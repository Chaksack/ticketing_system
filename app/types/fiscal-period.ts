export type FiscalPeriodStatus = 'open' | 'closed'

export interface FiscalPeriod {
  id: string
  label: string
  startDate: string
  endDate: string
  status: FiscalPeriodStatus
  createdAt: string
}
