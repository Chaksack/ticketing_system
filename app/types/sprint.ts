export type SprintStatus = 'planned' | 'active' | 'completed'

export interface Sprint {
  id: string
  name: string
  goal?: string
  status: SprintStatus
  startDate?: string
  endDate?: string
  createdBy?: string
  createdAt: string
  updatedAt: string
}
