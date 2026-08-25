import type { TicketPriority, TicketStatus } from './ticket'

export interface SlaPolicy {
  id: string
  priority: TicketPriority
  firstResponseMins: number
  resolutionMins: number
}

export interface Macro {
  id: string
  name: string
  body: string
  setStatus?: TicketStatus
  setPriority?: TicketPriority
  addTagId?: string
  createdAt: string
}

export type AutomationField = 'category' | 'subject'
export type AutomationOperator = 'equals' | 'contains'

export interface AutomationRule {
  id: string
  name: string
  enabled: boolean
  field: AutomationField
  operator: AutomationOperator
  value: string
  setPriority?: TicketPriority
  setStatus?: TicketStatus
  setAssigneeId?: string
  addTagId?: string
  createdAt: string
}
