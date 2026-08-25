export type StaffRole = 'admin' | 'agent' | 'bd'
export type StaffStatus = 'active' | 'disabled' | 'pending'

export interface StaffMember {
  id: string
  name: string
  email: string
  roles: StaffRole[]
  status: StaffStatus
  onCall: boolean
  createdAt: string
}
