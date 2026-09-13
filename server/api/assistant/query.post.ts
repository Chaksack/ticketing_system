import type { ChatTurn } from '../../utils/aiAssistant'

const MESSAGES_PER_HOUR = 40
const HOUR_MS = 60 * 60 * 1000

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)

  const limit = await checkRateLimit('ai-assistant', user.id, MESSAGES_PER_HOUR, HOUR_MS)
  if (!limit.allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many questions in a short time. Please wait a bit and try again.' })
  }

  const body = await readBody<{ messages?: ChatTurn[], message?: string }>(event)

  // Accept either a full conversation history (current UI) or a single message (kept for any
  // other caller), so this stays a drop-in replacement for the old single-shot endpoint.
  const history: ChatTurn[] = body?.messages?.length ? body.messages : [{ role: 'user', text: body?.message ?? '' }]

  await ensureDb()
  const result = await runAiAssistantChat(user, history)

  return result
})
