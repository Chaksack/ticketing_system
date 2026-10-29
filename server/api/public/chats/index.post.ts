const CHATS_PER_IP_PER_HOUR = 6
const HOUR_MS = 60 * 60 * 1000

/** Customer portal: start a live chat. Returns the visitor's private token for polling and replying. */
export default defineEventHandler(async (event) => {
  applyPortalCors(event)
  await useWorkspaceFromRequest(event)
  const body = await readBody<{ name?: string, email?: string, message?: string }>(event)

  const name = body?.name?.trim().slice(0, 120)
  const email = body?.email?.trim().toLowerCase()
  const message = body?.message?.trim().slice(0, 4000)
  if (!name || name.length < 2)
    throw createError({ statusCode: 400, statusMessage: 'Please enter your name' })
  if (!email || !/^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/.test(email))
    throw createError({ statusCode: 400, statusMessage: 'Please enter a valid email address' })
  if (!message)
    throw createError({ statusCode: 400, statusMessage: 'Type your question to start the chat' })

  await ensureDb()
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  if (!(await checkRateLimit('live-chat-start-ip', ip, CHATS_PER_IP_PER_HOUR, HOUR_MS)).allowed)
    throw createError({ statusCode: 429, statusMessage: 'Too many chats started recently. Please try again later or raise a request instead.' })

  const db = useTenantDb()
  const id = await nextPrefixedId('live_chat', 'CHAT', 5)
  const token = newChatToken()
  const now = new Date().toISOString()
  const identified = await identifyVisitor(email)
  await db.prepare(`
    INSERT INTO live_chats (id, token, visitor_name, visitor_email, client_id, status, subject, started_at, last_message_at)
    VALUES (?, ?, ?, ?, ?, 'waiting', ?, ?, ?)
  `).run(id, token, name, email, identified?.clientId ?? null, message.slice(0, 140), now, now)
  await addChatMessage(id, { authorType: 'visitor', authorName: name, body: message })

  // An AI agent answers first when one is switched on; otherwise whoever is on call is told someone is waiting.
  if (!(await assignAgentToNewChat(event, id)))
    await notifyChatWaiting(id, name, message)

  setResponseStatus(event, 201)
  return { token }
})
