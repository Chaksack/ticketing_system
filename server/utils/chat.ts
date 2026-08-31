import type { ChannelType, ChatChannel, ChatMessage } from '../../app/types/chat'
import type { AssigneeRef } from './assignees'

export interface ChatChannelRow {
  id: string
  type: string
  name: string | null
  created_by: string | null
  created_at: string
}

export interface ChatMessageRow {
  id: string
  channel_id: string
  author_id: string
  author_name?: string | null
  body: string
  created_at: string
  edited_at: string | null
  attachment_url?: string | null
  attachment_name?: string | null
  attachment_type?: string | null
  attachment_size?: number | null
}

export function mapChatMessageRow(row: ChatMessageRow): ChatMessage {
  return {
    id: row.id,
    channelId: row.channel_id,
    authorId: row.author_id,
    authorName: row.author_name ?? 'Unknown',
    body: row.body,
    createdAt: row.created_at,
    editedAt: row.edited_at ?? undefined,
    attachmentUrl: row.attachment_url ?? undefined,
    attachmentName: row.attachment_name ?? undefined,
    attachmentType: row.attachment_type ?? undefined,
    attachmentSize: row.attachment_size ?? undefined,
  }
}

export async function getChannelMembers(channelId: string): Promise<AssigneeRef[]> {
  const db = useDatabase()
  return await db.prepare(`
    SELECT staff.id, staff.name
    FROM chat_channel_members
    JOIN staff ON staff.id = chat_channel_members.staff_id
    WHERE chat_channel_members.channel_id = ?
    ORDER BY staff.name ASC
  `).all(channelId) as AssigneeRef[]
}

export async function isChannelMember(channelId: string, staffId: string): Promise<boolean> {
  const db = useDatabase()
  const row = await db.prepare('SELECT 1 FROM chat_channel_members WHERE channel_id = ? AND staff_id = ?').get(channelId, staffId)
  return !!row
}

export async function loadChannelForUser(channelId: string, userId: string): Promise<ChatChannel | null> {
  const db = useDatabase()

  const channelRow = await db.prepare('SELECT * FROM chat_channels WHERE id = ?').get(channelId) as ChatChannelRow | undefined
  if (!channelRow)
    return null

  const members = await getChannelMembers(channelId)

  const lastMessageRow = await db.prepare(`
    SELECT chat_messages.*, staff.name AS author_name
    FROM chat_messages
    LEFT JOIN staff ON staff.id = chat_messages.author_id
    WHERE chat_messages.channel_id = ?
    ORDER BY chat_messages.created_at DESC
    LIMIT 1
  `).get(channelId) as ChatMessageRow | undefined

  const memberRow = await db.prepare('SELECT last_read_at FROM chat_channel_members WHERE channel_id = ? AND staff_id = ?').get(channelId, userId) as { last_read_at: string | null } | undefined
  const lastReadAt = memberRow?.last_read_at ?? '1970-01-01T00:00:00.000Z'

  const unreadRow = await db.prepare(`
    SELECT COUNT(*) as count FROM chat_messages
    WHERE channel_id = ? AND created_at > ? AND author_id != ?
  `).get(channelId, lastReadAt, userId) as { count: number | string }

  return {
    id: channelRow.id,
    type: channelRow.type as ChannelType,
    name: channelRow.name ?? undefined,
    members,
    lastMessage: lastMessageRow ? mapChatMessageRow(lastMessageRow) : undefined,
    unreadCount: Number(unreadRow.count),
    createdAt: channelRow.created_at,
  }
}

export async function getChannelsForUser(userId: string): Promise<ChatChannel[]> {
  const db = useDatabase()

  const rows = await db.prepare('SELECT channel_id FROM chat_channel_members WHERE staff_id = ?').all(userId) as { channel_id: string }[]

  const channels: ChatChannel[] = []
  for (const row of rows) {
    const channel = await loadChannelForUser(row.channel_id, userId)
    if (channel)
      channels.push(channel)
  }

  channels.sort((a, b) => {
    const aTime = a.lastMessage?.createdAt ?? a.createdAt
    const bTime = b.lastMessage?.createdAt ?? b.createdAt
    return bTime.localeCompare(aTime)
  })

  return channels
}
