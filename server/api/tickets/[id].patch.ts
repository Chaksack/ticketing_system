import type { TicketPriority, TicketStatus } from '../../../app/types/ticket'
import type { TicketRow } from '../../utils/mappers'

interface UpdateTicketBody {
  status?: TicketStatus
  priority?: TicketPriority
  category?: string
  assigneeId?: string | null
  /** Re-link the ticket to a client / project; the project's contract SLA is re-applied while it's still open. */
  clientId?: string | null
  projectId?: string | null
}

const STATUS_LABELS: Record<TicketStatus, string> = {
  'open': 'Open',
  'in-progress': 'In Progress',
  'resolved': 'Resolved',
  'closed': 'Closed',
}

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)

  const id = getRouterParam(event, 'id')
  const body = await readBody<UpdateTicketBody>(event)

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing ticket id' })
  }

  await ensureDb()
  const db = useTenantDb()

  const existing = await db.prepare('SELECT * FROM tickets WHERE id = ?').get(id) as TicketRow | undefined
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Ticket not found' })
  }

  const status = body.status ?? existing.status as TicketStatus
  const priority = body.priority ?? existing.priority as TicketPriority
  const category = body.category ?? existing.category
  const assigneeId = body.assigneeId !== undefined ? body.assigneeId : existing.assignee_id
  const now = new Date().toISOString()

  const resolvedAt = status === 'resolved' && existing.status !== 'resolved' ? now : existing.resolved_at
  const closedAt = status === 'closed' && existing.status !== 'closed' ? now : existing.closed_at

  await db.prepare(`
    UPDATE tickets
    SET status = ?, priority = ?, category = ?, assignee_id = ?, resolved_at = ?, closed_at = ?, updated_at = ?
    WHERE id = ?
  `).run(status, priority, category, assigneeId, resolvedAt, closedAt, now, id)

  if (body.clientId !== undefined || body.projectId !== undefined) {
    const customer = body.clientId === null && !body.projectId
      ? { clientId: null, projectId: null, contractId: null }
      : await resolveTicketCustomer({ email: '', clientId: body.clientId !== undefined ? body.clientId : (body.projectId ? null : existing.client_id), projectId: body.projectId ?? null })
    await db.prepare('UPDATE tickets SET client_id = ?, project_id = ?, contract_id = ? WHERE id = ?').run(customer.clientId, customer.projectId, customer.contractId, id)
    // New contract → new targets, but only for deadlines that haven't been met or passed yet.
    if (customer.contractId !== existing.contract_id && status !== 'resolved' && status !== 'closed') {
      const { dueAt, firstResponseDueAt } = await computeSlaDeadlines(priority, existing.created_at, customer.contractId)
      await db.prepare('UPDATE tickets SET due_at = ?, first_response_due_at = CASE WHEN first_response_at IS NULL THEN ? ELSE first_response_due_at END WHERE id = ?').run(dueAt ?? null, firstResponseDueAt ?? null, id)
    }
    const names = await db.prepare('SELECT (SELECT name FROM clients WHERE id = ?) AS client, (SELECT name FROM projects WHERE id = ?) AS project').get(customer.clientId, customer.projectId) as { client: string | null, project: string | null }
    await logTicketActivity({ ticketId: id, type: 'automation_applied', actorId: user.id, actorName: user.name, message: customer.clientId ? `${user.name} linked this ticket to ${names.client}${names.project ? ` · ${names.project}` : ''}${customer.contractId ? ' (contract SLA applied)' : ''}` : `${user.name} unlinked the client` })
  }

  if (status !== existing.status) {
    await logTicketActivity({
      ticketId: id,
      type: 'status_changed',
      actorId: user.id,
      actorName: user.name,
      fromValue: STATUS_LABELS[existing.status as TicketStatus],
      toValue: STATUS_LABELS[status],
    })
  }

  if (priority !== existing.priority) {
    await logTicketActivity({
      ticketId: id,
      type: 'priority_changed',
      actorId: user.id,
      actorName: user.name,
      fromValue: existing.priority,
      toValue: priority,
    })
  }

  if (assigneeId !== existing.assignee_id) {
    let assigneeName: string | undefined
    if (assigneeId) {
      const staffRow = await db.prepare('SELECT name FROM staff WHERE id = ?').get(assigneeId) as { name: string } | undefined
      assigneeName = staffRow?.name
    }

    await logTicketActivity({
      ticketId: id,
      type: 'assignee_changed',
      actorId: user.id,
      actorName: user.name,
      toValue: assigneeName ?? 'Unassigned',
    })

    if (assigneeId) {
      await sendPushToStaff(assigneeId, {
        title: 'Ticket assigned to you',
        body: `[${priority.toUpperCase()}] ${id}: ${existing.subject}`,
        url: '/tickets',
      })
    }
  }

  const ticket = await loadFullTicket(id)
  return { ticket }
})
