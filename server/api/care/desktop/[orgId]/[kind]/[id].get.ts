/** One conversation's transcript, read from the client's workspace. */
export default defineEventHandler(async (event) => {
  const user = await requireCareStaff(event)
  const orgId = getRouterParam(event, 'orgId') ?? ''
  const kind = getRouterParam(event, 'kind')
  const id = getRouterParam(event, 'id') ?? ''
  const engagement = await engagementForOrg(orgId)
  if (!engagement || (!user.roles.includes('admin') && !engagement.agentIds.includes(user.id)))
    throw createError({ statusCode: 404, statusMessage: 'Conversation not found' })

  return runWithTenant(orgId, async () => {
    await ensureDb()
    const db = useTenantDb()
    if (kind === 'chat') {
      const chat = await loadChatDetail(id)
      if (!chat)
        throw createError({ statusCode: 404, statusMessage: 'Conversation not found' })
      return { kind, title: chat.subject ?? `Chat with ${chat.visitorName}`, customer: chat.visitorName, status: chat.status, messages: chat.messages.map(m => ({ id: m.id, author: m.authorType === 'visitor' ? chat.visitorName : m.authorName, fromCustomer: m.authorType === 'visitor', system: m.authorType === 'system', body: m.body, at: m.createdAt })) }
    }
    const ticket = await db.prepare('SELECT id, subject, description, requester, status, created_at FROM tickets WHERE id = ?').get(id) as { id: string, subject: string, description: string, requester: string, status: string, created_at: string } | undefined
    if (!ticket)
      throw createError({ statusCode: 404, statusMessage: 'Conversation not found' })
    const replies = await db.prepare('SELECT id, author, author_type, message, created_at FROM ticket_replies WHERE ticket_id = ? AND internal = 0 ORDER BY created_at').all(id) as { id: string, author: string, author_type: string, message: string, created_at: string }[]
    return {
      kind,
      title: ticket.subject,
      customer: ticket.requester,
      status: ticket.status,
      messages: [
        { id: `${id}-desc`, author: ticket.requester, fromCustomer: true, system: false, body: ticket.description, at: ticket.created_at },
        ...replies.map(r => ({ id: r.id, author: r.author, fromCustomer: r.author_type !== 'staff', system: false, body: r.message, at: r.created_at })),
      ],
    }
  })
})
