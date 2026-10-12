import type { WorkOrderTask } from '../../../../app/types/field'
import type { TicketPriority } from '../../../../app/types/ticket'

interface NewWorkOrderBody {
  title?: string
  description?: string
  clientId?: string
  ticketId?: string
  assetId?: string
  location?: string
  priority?: TicketPriority
  skill?: string
  durationMinutes?: number
  slaDueAt?: string
  tasks?: string[]
}

const PRIORITIES = ['low', 'medium', 'high', 'urgent']

/** New work order — directly, or from a ticket (`ticketId`), which pre-fills it and links back. */
export default defineEventHandler(async (event) => {
  const user = await requireDispatcher(event)
  const body = await readBody<NewWorkOrderBody>(event) ?? {}
  await ensureDb()
  const db = useTenantDb()

  let ticket: { id: string, subject: string, description: string, priority: TicketPriority, due_at: string | null, requester_email: string } | undefined
  if (body.ticketId) {
    ticket = await db.prepare('SELECT id, subject, description, priority, due_at, requester_email FROM tickets WHERE id = ?').get(body.ticketId) as typeof ticket
    if (!ticket)
      throw createError({ statusCode: 404, statusMessage: 'Ticket not found' })
  }

  const title = (body.title ?? ticket?.subject ?? '').trim()
  if (title.length < 3)
    throw createError({ statusCode: 400, statusMessage: 'Give the work order a title' })
  const priority = PRIORITIES.includes(body.priority ?? '') ? body.priority! : (ticket?.priority ?? 'medium')
  const duration = Math.round(Number(body.durationMinutes ?? 60))
  if (!Number.isFinite(duration) || duration < 15 || duration > 12 * 60)
    throw createError({ statusCode: 400, statusMessage: 'Duration must be between 15 minutes and 12 hours' })

  let clientId = body.clientId ?? null
  if (!clientId && ticket) {
    const match = await identifyVisitor(ticket.requester_email)
    clientId = match?.clientId ?? null
  }
  const tasks: WorkOrderTask[] = (body.tasks ?? []).map(label => label.trim()).filter(Boolean).slice(0, 40).map(label => ({ label, done: false }))

  const id = await nextPrefixedId('work_order', 'WO')
  const now = new Date().toISOString()
  await db.prepare(`
    INSERT INTO work_orders (id, title, description, client_id, ticket_id, asset_id, location, priority, skill, duration_minutes, sla_due_at, status, tasks, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unscheduled', ?, ?, ?, ?)
  `).run(id, title.slice(0, 200), body.description ?? ticket?.description ?? null, clientId, ticket?.id ?? null, body.assetId || null, body.location?.trim() || null, priority, body.skill?.trim() || null, duration, body.slaDueAt || ticket?.due_at || null, JSON.stringify(tasks), user.id, now, now)

  if (ticket)
    await logTicketActivity({ ticketId: ticket.id, type: 'work_order', actorId: user.id, actorName: user.name, message: `${user.name} created work order ${id} for a site visit` })

  setResponseStatus(event, 201)
  return { workOrder: await loadWorkOrder(id) }
})
