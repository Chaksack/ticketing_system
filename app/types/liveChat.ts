export type LiveChatStatus = 'waiting' | 'active' | 'closed'
export type LiveChatAuthor = 'visitor' | 'agent' | 'system'

export interface LiveChatMessage {
  id: string
  authorType: LiveChatAuthor
  authorName: string
  body: string
  createdAt: string
}

export interface LiveChatSummary {
  id: string
  visitorName: string
  visitorEmail: string
  clientId?: string
  clientName?: string
  status: LiveChatStatus
  assigneeId?: string
  assigneeName?: string
  ticketId?: string
  subject?: string
  lastMessage?: string
  lastMessageAt: string
  startedAt: string
  firstResponseAt?: string
  closedAt?: string
  careHandled: boolean
}

export interface LiveChatDetail extends LiveChatSummary {
  messages: LiveChatMessage[]
  /** Who the visitor is, when their email matches a client or client contact. */
  identified?: { clientId: string, clientName: string, contactName?: string, contactTitle?: string, stage: string }
}

export interface LiveChatQueueStats {
  waiting: number
  /** Seconds the longest-waiting visitor has waited for a first reply. */
  longestWaitSeconds: number
  activeChats: number
  agentsOnline: number
  agentsTotal: number
}

/** What the visitor's browser sees (no internal ids). */
export interface VisitorChatView {
  status: LiveChatStatus
  agentName?: string
  messages: LiveChatMessage[]
}
