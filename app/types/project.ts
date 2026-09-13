import type { AmcContract } from './amc'

export type ProjectStatus = 'planned' | 'active' | 'on_hold' | 'completed' | 'cancelled'

/** Rough visual progress per status — not a precise measure, just enough for a progress bar. */
export const PROJECT_STATUS_PROGRESS: Record<ProjectStatus, number> = {
  planned: 10,
  active: 55,
  on_hold: 55,
  completed: 100,
  cancelled: 0,
}

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
  taskCount: number
}
