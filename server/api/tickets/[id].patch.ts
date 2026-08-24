import type { TicketPriority, TicketStatus } from '../../../app/types/ticket'
import type { TicketRow } from '../../utils/mappers'

interface UpdateTicketBody {
  status?: TicketStatus
  priority?: TicketPriority
  category?: string
  assigneeId?: string | null
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
  const db = useDatabase()

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
