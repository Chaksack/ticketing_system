import type { BrowsableChatChannel, ChannelType, ChatChannel, ChatMessage, MessageReaction } from '../../app/types/chat'
import type { AssigneeRef } from './assignees'

export interface ChatChannelRow {
  id: string
  type: string
  name: string | null
  created_by: string | null
  created_at: string
  project_id: string | null
  project_name?: string | null
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

export function mapChatMessageRow(row: ChatMessageRow, reactions: MessageReaction[] = []): ChatMessage {
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
    reactions,
  }
}

export interface ChatReactionRow {
  message_id: string
  emoji: string
  staff_id: string
  staff_name: string
}

/** Aggregates raw reaction rows into one MessageReaction[] per message id, in one bulk query. */
export async function getReactionsForMessages(messageIds: string[], currentStaffId: string): Promise<Map<string, MessageReaction[]>> {
  const result = new Map<string, MessageReaction[]>()
  if (!messageIds.length)
    return result

  const db = useDatabase()
  const rows = await db.prepare(`
    SELECT chat_message_reactions.message_id AS message_id, chat_message_reactions.emoji AS emoji,
      chat_message_reactions.staff_id AS staff_id, staff.name AS staff_name
    FROM chat_message_reactions
    JOIN staff ON staff.id = chat_message_reactions.staff_id
    WHERE chat_message_reactions.message_id = ANY(?)
    ORDER BY chat_message_reactions.created_at ASC
  `).all(messageIds as unknown as string) as ChatReactionRow[]

  const byMessageAndEmoji = new Map<string, Map<string, ChatReactionRow[]>>()
  for (const row of rows) {
    const byEmoji = byMessageAndEmoji.get(row.message_id) ?? new Map<string, ChatReactionRow[]>()
    const group = byEmoji.get(row.emoji) ?? []
    group.push(row)
    byEmoji.set(row.emoji, group)
    byMessageAndEmoji.set(row.message_id, byEmoji)
  }

  for (const [messageId, byEmoji] of byMessageAndEmoji) {
    const reactions: MessageReaction[] = [...byEmoji.entries()].map(([emoji, group]) => ({
      emoji,
      count: group.length,
      reactedByMe: group.some(row => row.staff_id === currentStaffId),
      staffNames: group.map(row => row.staff_name),
    }))
    result.set(messageId, reactions)
  }

  return result
}

/** Toggles a staff member's reaction on a message: adds it if absent, removes it if already reacted. */
export async function toggleMessageReaction(messageId: string, staffId: string, emoji: string) {
  const db = useDatabase()

  const existing = await db.prepare('SELECT id FROM chat_message_reactions WHERE message_id = ? AND staff_id = ? AND emoji = ?').get(messageId, staffId, emoji) as { id: string } | undefined

  if (existing) {
    await db.prepare('DELETE FROM chat_message_reactions WHERE id = ?').run(existing.id)
    return
  }

  const id = await nextChatReactionId()
  await db.prepare('INSERT INTO chat_message_reactions (id, message_id, staff_id, emoji, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, messageId, staffId, emoji, new Date().toISOString())
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

interface BrowsableChannelRow extends ChatChannelRow {
  joined: number
}

/** Every project channel, with the project's name and whether the current user has already joined — used by the "Browse channels" picker. */
export async function getBrowsableProjectChannels(userId: string): Promise<BrowsableChatChannel[]> {
  const db = useDatabase()

  const rows = await db.prepare(`
    SELECT chat_channels.*, projects.name AS project_name,
      (SELECT 1 FROM chat_channel_members WHERE chat_channel_members.channel_id = chat_channels.id AND chat_channel_members.staff_id = ?) AS joined
    FROM chat_channels
    LEFT JOIN projects ON projects.id = chat_channels.project_id
    WHERE chat_channels.type = 'project'
    ORDER BY chat_channels.created_at DESC
  `).all(userId) as BrowsableChannelRow[]

  return rows.map(row => ({
    id: row.id,
    type: 'project' as ChannelType,
    name: row.name ?? undefined,
    members: [],
    unreadCount: 0,
    projectId: row.project_id ?? undefined,
    projectName: row.project_name ?? undefined,
    createdAt: row.created_at,
    joined: !!row.joined,
  }))
}

export async function loadChannelForUser(channelId: string, userId: string): Promise<ChatChannel | null> {
  const db = useDatabase()

  const channelRow = await db.prepare(`
    SELECT chat_channels.*, projects.name AS project_name
    FROM chat_channels
    LEFT JOIN projects ON projects.id = chat_channels.project_id
    WHERE chat_channels.id = ?
  `).get(channelId) as ChatChannelRow | undefined
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
    projectId: channelRow.project_id ?? undefined,
    projectName: channelRow.project_name ?? undefined,
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
