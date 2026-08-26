import type { AmcContract } from './amc'

export type ProjectStatus = 'planned' | 'active' | 'on_hold' | 'completed' | 'cancelled'

export interface Project {
  id: string
  clientId: string
  clientName?: string
  name: string
  description?: string
  status: ProjectStatus
  startDate?: string
  endDate?: string
  erpProjectId?: string
  createdBy?: string
  createdAt: string
  updatedAt: string
  contracts: AmcContract[]
}
