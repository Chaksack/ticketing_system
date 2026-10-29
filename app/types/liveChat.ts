/** ai: an AI agent is handling it; waiting: queued for a person; active: a person is on it. */
export type LiveChatStatus = 'ai' | 'waiting' | 'active' | 'closed'
/** ai: an AI agent's reply; note: an internal note only staff see. */
export type LiveChatAuthor = 'visitor' | 'agent' | 'ai' | 'system' | 'note'

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
  aiAgentId?: string
  aiAgentName?: string
  /** Why the AI passed the chat to a person. */
  handoffReason?: string
  handedOffAt?: string
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
  /** Chats an AI agent is handling right now. */
  aiHandling: number
}

/** What the visitor's browser sees (no internal ids). */
export interface VisitorChatView {
  status: LiveChatStatus
  agentName?: string
  /** The AI agent's name while it is handling the chat. */
  aiAgentName?: string
  /** The AI is writing a reply. */
  typing?: boolean
  messages: LiveChatMessage[]
}
