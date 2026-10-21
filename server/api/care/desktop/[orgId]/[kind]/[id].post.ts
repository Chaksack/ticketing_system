/**
 * Care agent actions in a client's workspace: reply (as "<name> · Canopy Care"), open a case from a
 * chat, or warm-transfer the conversation to the client's own team.
 */
export default defineEventHandler(async (event) => {
  const user = await requireCareStaff(event)
  const orgId = getRouterParam(event, 'orgId') ?? ''
  const kind = getRouterParam(event, 'kind')
  const id = getRouterParam(event, 'id') ?? ''
  const engagement = await engagementForOrg(orgId)
  if (!engagement || !['pilot', 'live'].includes(engagement.stage) || !canWorkEngagement(user, engagement))
    throw createError({ statusCode: 403, statusMessage: 'You are not certified for this client' })
  const body = await readBody<{ action?: 'reply' | 'create_case' | 'transfer', message?: string }>(event) ?? {}
  const author = careAuthorName(user.name)

  return runWithTenant(orgId, async () => {
    await ensureDb()
    const db = useTenantDb()
    const notifyOnCall = async (title: string, url: string) => {
      const onCall = await db.prepare('SELECT id FROM staff WHERE on_call = 1 AND status = \'active\'').all() as { id: string }[]
      for (const member of onCall)
        await createNotification({ staffId: member.id, type: 'live_chat', title, body: `From Canopy Care (${user.name})`, url })
    }

    if (body.action === 'reply') {
      const message = body.message?.trim().slice(0, 4000)
      if (!message)
        throw createError({ statusCode: 400, statusMessage: 'Message is empty' })
      if (kind === 'chat') {
        await addAgentChatMessage(id, { id: user.id, name: author }, message, { care: true })
      }
      else {
        const ticket = await db.prepare('SELECT id, subject, requester, requester_email, first_response_at FROM tickets WHERE id = ?').get(id) as { id: string, subject: string, requester: string, requester_email: string, first_response_at: string | null } | undefined
        if (!ticket)
          throw createError({ statusCode: 404, statusMessage: 'Ticket not found' })
        const now = new Date().toISOString()
        await db.prepare('INSERT INTO ticket_replies (id, ticket_id, author, message, created_at, internal, author_id, author_type, care_agent) VALUES (?, ?, ?, ?, ?, 0, NULL, \'staff\', 1)').run(await nextReplyId(), id, author, message, now)
        await db.prepare('UPDATE tickets SET first_response_at = COALESCE(first_response_at, ?), status = CASE WHEN status = \'open\' THEN \'in-progress\' ELSE status END, updated_at = ? WHERE id = ?').run(now, now, id)
        await sendTicketReplyEmail({ to: ticket.requester_email, name: ticket.requester, ticketId: id, subject: ticket.subject, message }).catch(error => console.error('Care reply email failed', error))
      }
      return { ok: true }
    }

    if (body.action === 'create_case' && kind === 'chat') {
      const ticketId = await createTicketFromChat(id, { id: user.id, name: author })
      return { ok: true, ticketId }
    }

    if (body.action === 'transfer') {
      if (kind === 'chat') {
        await db.prepare('UPDATE live_chats SET assignee_id = NULL, assignee_name = NULL, care_handled = 0 WHERE id = ?').run(id)
        await addChatMessage(id, { authorType: 'system', authorName: 'System', body: `${user.name} from Canopy Care is passing you to the ${engagement.orgName} team.` })
        await notifyOnCall(`Canopy Care transferred a chat to you (${id})`, `/inbox?open=${id}`)
      }
      else {
        await db.prepare('INSERT INTO ticket_replies (id, ticket_id, author, message, created_at, internal, author_type, care_agent) VALUES (?, ?, ?, ?, ?, 1, \'staff\', 1)').run(await nextReplyId(), id, author, 'Canopy Care: handing this to your team — it needs someone from the company.', new Date().toISOString())
        await notifyOnCall(`Canopy Care handed ${id} to your team`, `/tickets/${id}`)
      }
      return { ok: true }
    }
    throw createError({ statusCode: 400, statusMessage: 'Unknown action' })
  })
})
