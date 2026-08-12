export type StaffRole = 'admin' | 'agent'
export type StaffStatus = 'active' | 'disabled' | 'pending'

export interface StaffMember {
  id: string
  name: string
  email: string
  role: StaffRole
  status: StaffStatus
  onCall: boolean
  createdAt: string
}
