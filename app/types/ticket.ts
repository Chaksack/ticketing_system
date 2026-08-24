export type TicketStatus = 'open' | 'in-progress' | 'resolved' | 'closed'
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'
export type SlaStatus = 'on-track' | 'at-risk' | 'breached'
export type ReplyAuthorType = 'staff' | 'customer' | 'system'

export interface TicketReply {
  id: string
  author: string
  message: string
  createdAt: string
  internal: boolean
  authorId?: string
  authorType: ReplyAuthorType
}

export type TicketActivityType
  = | 'status_changed'
    | 'priority_changed'
    | 'assignee_changed'
    | 'tag_added'
    | 'tag_removed'
    | 'macro_applied'
    | 'sla_escalated'
    | 'auto_assigned'
    | 'automation_applied'

export interface TicketActivity {
  id: string
  ticketId: string
  type: TicketActivityType
  actorId?: string
  actorName?: string
  fromValue?: string
  toValue?: string
  message?: string
  createdAt: string
}

export interface TicketTag {
  id: string
  name: string
  color: string
}

export interface Ticket {
  id: string
  subject: string
  description: string
  requester: string
  requesterEmail: string
  category: string
  status: TicketStatus
  priority: TicketPriority
  referenceNumber?: string
  attachments?: string[]
  createdAt: string
  updatedAt: string
  replies: TicketReply[]
  activity: TicketActivity[]
  tags: TicketTag[]
  assigneeId?: string
  assigneeName?: string
  dueAt?: string
  firstResponseDueAt?: string
  firstResponseAt?: string
  resolvedAt?: string
  closedAt?: string
  slaEscalated: boolean
}
