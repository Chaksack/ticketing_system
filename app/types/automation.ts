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

export type BdEntityType = 'lead' | 'tender'
export type BdRuleTrigger = 'created' | 'stage_changed'
export type BdRuleField = 'source'
export type BdRuleOperator = 'equals' | 'contains'

export interface BdAutomationRule {
  id: string
  entityType: BdEntityType
  trigger: BdRuleTrigger
  name: string
  enabled: boolean
  /** Only meaningful when trigger is 'created' — matched against the record's source. */
  field?: BdRuleField
  operator?: BdRuleOperator
  value?: string
  /** Only meaningful when trigger is 'stage_changed'. */
  toStage?: string
  setAssigneeId?: string
  notifyStaffId?: string
  createdAt: string
}
