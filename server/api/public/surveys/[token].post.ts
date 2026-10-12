/**
 * The customer's rating (1–5). A low score (1–2) reopens the ticket and tells whoever owns it,
 * so a poor experience gets a second look rather than just a number.
 */
export default defineEventHandler(async (event) => {
  await useWorkspaceFromRequest(event)
  await ensureDb()
  const db = useTenantDb()
  const body = await readBody<{ rating?: number, comment?: string }>(event)
  const rating = Math.round(Number(body?.rating))
  if (!(rating >= 1 && rating <= 5))
    throw createError({ statusCode: 400, statusMessage: 'Choose a rating from 1 to 5' })

  const token = getRouterParam(event, 'token') ?? ''
  const survey = await db.prepare('SELECT id, ticket_id, responded_at FROM ticket_surveys WHERE token = ?').get(token) as { id: string, ticket_id: string, responded_at: string | null } | undefined
  if (!survey)
    throw createError({ statusCode: 404, statusMessage: 'This survey link is not valid' })
  if (survey.responded_at)
    throw createError({ statusCode: 409, statusMessage: 'Thanks — we already have your feedback for this request.' })

  const now = new Date().toISOString()
  const comment = body?.comment?.trim().slice(0, 2000) || null
  await db.prepare('UPDATE ticket_surveys SET rating = ?, comment = ?, responded_at = ? WHERE id = ?').run(rating, comment, now, survey.id)
  await logTicketActivity({ ticketId: survey.ticket_id, type: 'automation_applied', actorName: 'Customer', message: `Customer rated the service ${rating}/5${comment ? `: "${comment.slice(0, 160)}"` : ''}` })

  if (rating <= 2) {
    const ticket = await db.prepare('SELECT assignee_id, status FROM tickets WHERE id = ?').get(survey.ticket_id) as { assignee_id: string | null, status: string } | undefined
    if (ticket && (ticket.status === 'resolved' || ticket.status === 'closed')) {
      await db.prepare('UPDATE tickets SET status = \'open\', resolved_at = NULL, closed_at = NULL, updated_at = ? WHERE id = ?').run(now, survey.ticket_id)
      await logTicketActivity({ ticketId: survey.ticket_id, type: 'status_changed', actorName: 'Survey rule', fromValue: ticket.status, toValue: 'open', message: 'Reopened for review after a low satisfaction score' })
    }
    if (ticket?.assignee_id)
      await createNotification({ staffId: ticket.assignee_id, type: 'reply', title: `Low satisfaction score on ${survey.ticket_id}`, body: `Rated ${rating}/5${comment ? `: ${comment.slice(0, 100)}` : ''}`, url: `/tickets/${survey.ticket_id}`, ticketId: survey.ticket_id })
  }
  return { ok: true }
})
