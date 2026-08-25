export interface AmcPlan {
  id: string
  name: string
  description?: string
  defaultDurationMonths: number
  price?: number
  createdAt: string
}

export type AmcContractStatus = 'active' | 'cancelled' | 'expired'
export type AmcContractDisplayStatus = 'active' | 'expiring' | 'expired' | 'cancelled'

export interface AmcContract {
  id: string
  clientId: string
  planId: string
  planName?: string
  startDate: string
  endDate: string
  status: AmcContractStatus
  reminder30dSent: boolean
  reminder7dSent: boolean
  createdAt: string
}
