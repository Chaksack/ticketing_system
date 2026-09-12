import type { Assignee } from './assignee'

export type ChannelType = 'direct' | 'group'

/** The fixed quick-react set — shared by the client picker and the server's validation. */
export const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '😮', '😢', '🙏', '👀'] as const

export interface MessageReaction {
  emoji: string
  count: number
  reactedByMe: boolean
  staffNames: string[]
}

export interface ChatMessage {
  id: string
  channelId: string
  authorId: string
  authorName: string
  body: string
  createdAt: string
  editedAt?: string
  attachmentUrl?: string
  attachmentName?: string
  attachmentType?: string
  attachmentSize?: number
  reactions: MessageReaction[]
}

export interface ChatChannel {
  id: string
  type: ChannelType
  name?: string
  members: Assignee[]
  lastMessage?: ChatMessage
  unreadCount: number
  createdAt: string
}
