import type { TicketPriority } from './ticket'

export type WorkOrderStatus = 'unscheduled' | 'scheduled' | 'travelling' | 'in_progress' | 'completed' | 'cancelled'

export const WORK_ORDER_STATUSES: { value: WorkOrderStatus, label: string }[] = [
  { value: 'unscheduled', label: 'To schedule' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'travelling', label: 'Travelling' },
  { value: 'in_progress', label: 'On site' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

/** Working day shown on the schedule board and used by auto-schedule (local hours). */
export const FIELD_DAY_START_HOUR = 8
export const FIELD_DAY_END_HOUR = 18

export interface WorkOrderTask {
  label: string
  done: boolean
}

export interface WorkOrderPhoto {
  url: string
  name: string
}

export interface WorkOrder {
  id: string
  title: string
  description?: string
  clientId?: string
  clientName?: string
  ticketId?: string
  assetId?: string
  assetName?: string
  location?: string
  priority: TicketPriority
  /** Skill needed, matched against technicians' skills by auto-schedule. */
  skill?: string
  durationMinutes: number
  slaDueAt?: string
  status: WorkOrderStatus
  technicianId?: string
  technicianName?: string
  scheduledStart?: string
  tasks: WorkOrderTask[]
  photos: WorkOrderPhoto[]
  signatureUrl?: string
  signedBy?: string
  resolutionNotes?: string
  travelStartedAt?: string
  startedAt?: string
  completedAt?: string
  createdAt: string
  updatedAt: string
}

export interface WorkOrderDetail extends WorkOrder {
  /** Earlier work orders on the same asset, newest first. */
  assetHistory: Pick<WorkOrder, 'id' | 'title' | 'status' | 'completedAt' | 'resolutionNotes' | 'technicianName'>[]
}

export interface FieldAsset {
  id: string
  clientId?: string
  clientName?: string
  name: string
  model?: string
  serial?: string
  location?: string
  installedAt?: string
  notes?: string
  workOrderCount: number
  lastServicedAt?: string
  createdAt: string
}

export interface Technician {
  id: string
  name: string
  avatarUrl?: string
  skills: string[]
}

export interface TechnicianUnavailability {
  id: string
  technicianId: string
  startAt: string
  endAt: string
  reason?: string
}

/** A slot auto-schedule proposes; nothing is saved until the dispatcher applies it. */
export interface ScheduleSuggestion {
  workOrderId: string
  technicianId: string
  scheduledStart: string
}
