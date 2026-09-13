export interface TimesheetEntry {
  id: string
  staffId: string
  staffName?: string
  taskId: string
  taskTitle?: string
  projectId?: string
  projectName?: string
  workDate: string
  hours: number
  hourlyRate: number
  billable: boolean
  notes?: string
  createdAt: string
  updatedAt: string
}
