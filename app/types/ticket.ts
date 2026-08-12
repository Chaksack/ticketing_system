export type TicketStatus = 'open' | 'in-progress' | 'resolved' | 'closed'
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface TicketReply {
  id: string
  author: string
  message: string
  createdAt: string
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
  replies: TicketReply[]
}
