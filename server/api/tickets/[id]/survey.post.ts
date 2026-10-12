import { randomBytes } from 'node:crypto'

/** Emails the requester a one-question satisfaction survey for this ticket. */
export default defineEventHandler(async (event) => {
  await requireServiceStaff(event)
  const id = getRouterParam(event, 'id') ?? ''
  await ensureDb()
  const db = useTenantDb()

  const ticket = await db.prepare('SELECT id, subject, requester, requester_email FROM tickets WHERE id = ?').get(id) as { id: string, subject: string, requester: string, requester_email: string } | undefined
  if (!ticket)
    throw createError({ statusCode: 404, statusMessage: 'Ticket not found' })

  const surveyId = await nextPrefixedId('ticket_survey', 'SRV', 5)
  const token = randomBytes(20).toString('hex')
  await db.prepare('INSERT INTO ticket_surveys (id, token, ticket_id, email, sent_at) VALUES (?, ?, ?, ?, ?)').run(surveyId, token, id, ticket.requester_email, new Date().toISOString())

  try {
    await sendSurveyEmail({ to: ticket.requester_email, name: ticket.requester, ticketId: id, subject: ticket.subject, token })
  }
  catch (error) {
    console.error('Failed to send survey email', error)
    throw createError({ statusCode: 502, statusMessage: 'The survey email could not be sent. Check the Gmail connection.' })
  }
  return { ok: true }
})
