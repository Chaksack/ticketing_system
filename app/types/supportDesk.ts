import type { LiveChatStatus } from './liveChat'
import type { PresenceState } from './presence'

/** Someone who raised a ticket or started a chat, keyed by email. */
export interface SupportCustomer {
  email: string
  name: string
  phone?: string
  clientId?: string
  clientName?: string
  ticketCount: number
  openTickets: number
  chatCount: number
  lastContactAt: string
  /** Average satisfaction rating (1–5) from surveys, if any. */
  rating?: number
}

export interface SupportCustomerDetail extends SupportCustomer {
  notes?: string
  updatedBy?: string
  tickets: { id: string, subject: string, status: string, priority: string, createdAt: string, updatedAt: string }[]
  chats: { id: string, subject?: string, status: LiveChatStatus, startedAt: string, aiAgentName?: string, assigneeName?: string, ticketId?: string }[]
  surveys: { ticketId: string, rating: number, comment?: string, respondedAt: string }[]
}

/** A person on the support desk, with their load right now. */
export interface SupportAgent {
  id: string
  name: string
  email: string
  roles: string[]
  status: string
  presence: PresenceState
  onCall: boolean
  onShift: boolean
  /** Today's shifts, e.g. "08:00–16:00". */
  shiftToday?: string
  openTickets: number
  activeChats: number
  resolvedThisWeek: number
  rating?: number
}

export interface SupportShift {
  id: string
  staffId: string
  weekday: number
  startTime: string
  endTime: string
}

export interface MonitorChat {
  id: string
  status: LiveChatStatus
  visitorName: string
  visitorEmail: string
  clientName?: string
  subject?: string
  aiAgentName?: string
  assigneeName?: string
  handoffReason?: string
  aiThinking: boolean
  startedAt: string
  /** When the customer started waiting for a person (handoff or start). */
  waitingSince?: string
  lastMessageAt: string
  lastAuthor?: string
  messageCount: number
  recent: { authorType: string, authorName: string, body: string, createdAt: string }[]
  tags: { id: string, name: string, color: string }[]
}

export interface MonitorStats {
  startedToday: number
  aiHandledToday: number
  handedOffToday: number
  closedToday: number
  avgFirstResponseSeconds?: number
  agentsOnline: number
}

export type SupportChannelId = 'web_chat' | 'portal' | 'email' | 'api' | 'whatsapp' | 'telegram'

export interface SupportChannel {
  id: SupportChannelId
  name: string
  description: string
  /** connected: working; off: switched off; setup: needs configuring; soon: not available yet. */
  state: 'connected' | 'off' | 'setup' | 'soon'
  detail?: string
  enabled?: boolean
  config?: Record<string, string>
}

export interface TagWithUsage {
  id: string
  name: string
  color: string
  tickets: number
  chats: number
}
