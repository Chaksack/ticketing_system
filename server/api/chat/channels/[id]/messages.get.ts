import type { ChatMessageRow } from '../../../../utils/chat'

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const channelId = getRouterParam(event, 'id')

  if (!channelId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing channel id' })
  }

  await ensureDb()

  if (!await isChannelMember(channelId, user.id)) {
    throw createError({ statusCode: 403, statusMessage: 'You are not a member of this channel' })
  }

  const db = useDatabase()
  const rows = await db.prepare(`
    SELECT chat_messages.*, staff.name AS author_name
    FROM chat_messages
    LEFT JOIN staff ON staff.id = chat_messages.author_id
    WHERE chat_messages.channel_id = ?
    ORDER BY chat_messages.created_at DESC
    LIMIT 100
  `).all(channelId) as ChatMessageRow[]

  const messages = rows.map(mapChatMessageRow).reverse()
  return { messages }
})
