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
