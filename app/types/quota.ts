/** A quota period is either a month ("2026-09") or a whole year ("2026"). */
export type BdQuotaPeriodType = 'month' | 'year'

export const QUOTA_PERIOD_PATTERN = /^\d{4}(-(0[1-9]|1[0-2]))?$/

export function quotaPeriodType(period: string): BdQuotaPeriodType {
  return period.length === 4 ? 'year' : 'month'
}

export interface BdQuota {
  id: string
  staffId: string
  staffName?: string
  period: string
  targetValue: number
  createdAt: string
  updatedAt: string
}

export interface BdQuotaProgress {
  staffId: string
  staffName: string
  targetValue: number | null
  achievedValue: number
  percent: number | null
}
