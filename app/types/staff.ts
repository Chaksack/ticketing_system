export type StaffRole = 'admin' | 'agent' | 'bd' | 'sm' | 'finance' | 'engineer' | 'engineering_coordinator' | 'engineering_lead'
export type StaffStatus = 'active' | 'disabled' | 'pending'
/** Canopy HQ access, only in Canopy's own workspace: 'admin' runs HQ, 'agent' works the Care agent desktop. */
export type HqRole = 'admin' | 'agent'

export const HQ_ROLE_OPTIONS: { value: HqRole | 'none', label: string, description: string }[] = [
  { value: 'admin', label: 'HQ admin', description: 'Client companies, onboarding, Canopy Care and this team' },
  { value: 'agent', label: 'Care agent', description: 'The agent desktop, for the clients they are assigned to' },
  { value: 'none', label: 'Workspace only', description: 'Canopy\'s own CRM — no HQ access' },
]

export interface StaffMember {
  id: string
  name: string
  email: string
  roles: StaffRole[]
  /** Set only in Canopy's own workspace. */
  hqRole?: HqRole
  status: StaffStatus
  onCall: boolean
  avatarUrl?: string
  managerId?: string
  hourlyRate?: number
  createdAt: string
}
