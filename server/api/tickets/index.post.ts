import type { TicketPriority } from '../../../app/types/ticket'

interface NewTicketBody {
  subject?: string
  description?: string
  requester?: string
  requesterEmail?: string
  category?: string
  priority?: TicketPriority
  referenceNumber?: string
  attachments?: string[]
  assigneeId?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<NewTicketBody>(event)

  if (!body?.subject || !body?.description || !body?.requester || !body?.requesterEmail || !body?.category || !body?.priority) {
    throw createError({ statusCode: 400, statusMessage: 'subject, description, requester, requesterEmail, category and priority are required' })
  }

  await ensureDb()
  const db = useDatabase()

  const id = await nextTicketId()
  const now = new Date().toISOString()
  const attachments = body.attachments?.length ? JSON.stringify(body.attachments) : null
  const { dueAt, firstResponseDueAt } = await computeSlaDeadlines(body.priority, now)

  await db.prepare(`
    INSERT INTO tickets (
      id, subject, description, requester, requester_email, category, status, priority,
      reference_number, attachments, created_at, updated_at, assignee_id, due_at, first_response_due_at
    )
    VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    body.subject,
    body.description,
    body.requester,
    body.requesterEmail,
    body.category,
    body.priority,
    body.referenceNumber ?? null,
    attachments,
    now,
    now,
    body.assigneeId ?? null,
    dueAt ?? null,
    firstResponseDueAt ?? null,
  )

  let ticket = await loadFullTicket(id)
  ticket = await applyAutomationRules(ticket)
  ticket = await autoAssign(ticket)

  const pagedCount = await pageOnCallForTicket(ticket)

  setResponseStatus(event, 201)
  return { ticket, pagedCount }
})
