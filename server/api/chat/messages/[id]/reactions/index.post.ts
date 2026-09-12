import type { ChatMessageRow } from '../../../../../utils/chat'
import { QUICK_REACTIONS } from '../../../../../../app/types/chat'

interface ToggleReactionBody {
  emoji?: string
}

// A curated quick-react set, matching what the client renders — kept in sync deliberately
// rather than accepting arbitrary text, so a "reaction" can never become a way to post free text.
const ALLOWED_EMOJI = new Set<string>(QUICK_REACTIONS)

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)

  const messageId = getRouterParam(event, 'id')
  const body = await readBody<ToggleReactionBody>(event)

  if (!messageId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing message id' })
  }

  if (!body?.emoji || !ALLOWED_EMOJI.has(body.emoji)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid emoji' })
  }

  await ensureDb()
  const db = useDatabase()

  const messageRow = await db.prepare(`
    SELECT chat_messages.*, staff.name AS author_name
    FROM chat_messages
    LEFT JOIN staff ON staff.id = chat_messages.author_id
    WHERE chat_messages.id = ?
  `).get(messageId) as ChatMessageRow | undefined
  if (!messageRow) {
    throw createError({ statusCode: 404, statusMessage: 'Message not found' })
  }

  if (!await isChannelMember(messageRow.channel_id, user.id)) {
    throw createError({ statusCode: 403, statusMessage: 'You are not a member of this channel' })
  }

  await toggleMessageReaction(messageId, user.id, body.emoji)

  const reactionsByMessage = await getReactionsForMessages([messageId], user.id)
  const message = mapChatMessageRow(messageRow, reactionsByMessage.get(messageId) ?? [])

  return { message }
})
