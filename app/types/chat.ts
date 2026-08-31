import type { Assignee } from './assignee'

export type ChannelType = 'direct' | 'group'

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
