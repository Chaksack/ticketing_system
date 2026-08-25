import type { SlaStatus, Ticket } from '../types/ticket'

const AT_RISK_THRESHOLD = 0.2

export function getSlaStatus(ticket: Pick<Ticket, 'dueAt' | 'createdAt' | 'status' | 'resolvedAt'>): SlaStatus | undefined {
  if (!ticket.dueAt)
    return undefined

  if (ticket.status === 'resolved' || ticket.status === 'closed') {
    if (!ticket.resolvedAt)
      return 'on-track'
    return new Date(ticket.resolvedAt).getTime() <= new Date(ticket.dueAt).getTime() ? 'on-track' : 'breached'
  }

  const now = Date.now()
  const due = new Date(ticket.dueAt).getTime()
  if (now > due)
    return 'breached'

  const created = new Date(ticket.createdAt).getTime()
  const totalWindow = due - created
  const remaining = due - now
  if (totalWindow > 0 && remaining / totalWindow <= AT_RISK_THRESHOLD)
    return 'at-risk'

  return 'on-track'
}
