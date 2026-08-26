export interface AmcPlan {
  id: string
  name: string
  description?: string
  defaultDurationMonths: number
  price?: number
  currency: string
  createdAt: string
}

// submitted/negotiating happen before the contract is signed; active/expired/cancelled are its
// signed lifecycle; lost means the deal fell through at any point.
export type AmcContractStatus = 'submitted' | 'negotiating' | 'active' | 'lost' | 'cancelled' | 'expired'
// 'expiring' is derived only (active + close to endDate) — never persisted, used for badge color.
export type AmcContractDisplayStatus = 'submitted' | 'negotiating' | 'active' | 'expiring' | 'lost' | 'cancelled' | 'expired'

export interface AmcContract {
  id: string
  clientId: string
  projectId?: string
  planId: string
  planName?: string
  startDate: string
  endDate: string
  status: AmcContractStatus
  reminder30dSent: boolean
  reminder7dSent: boolean
  nextStep?: string
  nextStepAt?: string
  nextStepReminderSent: boolean
  createdAt: string
}
