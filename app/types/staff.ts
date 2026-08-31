export type StaffRole = 'admin' | 'agent' | 'bd' | 'sm' | 'engineer' | 'engineering_coordinator' | 'engineering_lead'
export type StaffStatus = 'active' | 'disabled' | 'pending'

export interface StaffMember {
  id: string
  name: string
  email: string
  roles: StaffRole[]
  status: StaffStatus
  onCall: boolean
  avatarUrl?: string
  createdAt: string
}
