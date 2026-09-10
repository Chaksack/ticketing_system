export type RegardingType = 'lead' | 'tender' | 'client'

export type InteractionType = 'email' | 'call' | 'meeting' | 'note'

export type InteractionDirection = 'sent' | 'received'

export interface Interaction {
  id: string
  type: InteractionType
  subject?: string
  body?: string
  direction?: InteractionDirection
  gmailMessageId?: string
  gmailThreadId?: string
  occurredAt: string
  loggedBy?: string
  loggedByName?: string
  createdAt: string
}
