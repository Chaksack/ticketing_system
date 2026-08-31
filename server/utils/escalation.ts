import type { EscalationLevel, Ticket } from '../../app/types/ticket'
import type { StaffRow, TicketRow } from './mappers'
import { parseStaffRoles } from './mappers'

export const ESCALATION_LEVELS: EscalationLevel[] = ['engineer', 'engineering_coordinator', 'engineering_lead']

export const ESCALATION_LABELS: Record<EscalationLevel, string> = {
  engineer: 'Engineer',
  engineering_coordinator: 'Engineering Coordinator',
  engineering_lead: 'Engineering Lead',
}

export function nextEscalationLevel(current: string | null): EscalationLevel | null {
  if (!current)
    return ESCALATION_LEVELS[0]!

  const index = ESCALATION_LEVELS.indexOf(current as EscalationLevel)
  return index === -1 || index === ESCALATION_LEVELS.length - 1 ? null : ESCALATION_LEVELS[index + 1]!
}

/**
 * Mirrors autoAssign()'s least-loaded query (server/utils/automation.ts), filtered to staff
 * holding the target escalation role. Filtered in JS via parseStaffRoles() since roles are
 * stored as a JSON array column, not queryable with plain SQL.
 */
async function leastLoadedStaffWithRole(role: EscalationLevel): Promise<StaffRow | undefined> {
  const db = useDatabase()

  const staffRows = await db.prepare('SELECT * FROM staff WHERE status = \'active\'').all() as StaffRow[]
  const candidates = staffRows.filter(row => parseStaffRoles(row).includes(role))
  if (!candidates.length)
    return undefined

  const loadRows = await db.prepare(`
    SELECT assignee_id, COUNT(*) AS open_count
    FROM tickets
    WHERE assignee_id IS NOT NULL AND status IN ('open', 'in-progress')
    GROUP BY assignee_id
  `).all() as { assignee_id: string, open_count: number | string }[]
  const loadById = new Map(loadRows.map(row => [row.assignee_id, Number(row.open_count)]))

  return [...candidates].sort((a, b) => (loadById.get(a.id) ?? 0) - (loadById.get(b.id) ?? 0))[0]
}

export async function escalateTicket(ticketId: string, actor: { id?: string, name: string }): Promise<Ticket> {
  const db = useDatabase()

  const existing = await db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId) as TicketRow | undefined
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Ticket not found' })
  }

  const level = nextEscalationLevel(existing.escalation_level)
  if (!level) {
    throw createError({ statusCode: 409, statusMessage: 'Ticket is already at the highest escalation level' })
  }

  const candidate = await leastLoadedStaffWithRole(level)
  const now = new Date().toISOString()

  await db.prepare('UPDATE tickets SET escalation_level = ?, assignee_id = ?, updated_at = ? WHERE id = ?')
    .run(level, candidate?.id ?? existing.assignee_id, now, ticketId)

  await logTicketActivity({
    ticketId,
    type: 'escalated',
    actorId: actor.id,
    actorName: actor.name,
    fromValue: existing.escalation_level ? ESCALATION_LABELS[existing.escalation_level as EscalationLevel] : 'None',
    toValue: ESCALATION_LABELS[level],
    message: candidate ? `Escalated to ${ESCALATION_LABELS[level]} — assigned to ${candidate.name}` : `Escalated to ${ESCALATION_LABELS[level]} — no available staff to assign`,
  })

  if (candidate) {
    const title = 'Ticket escalated to you'
    const body = `[${existing.priority.toUpperCase()}] ${ticketId}: ${existing.subject}`
    const url = '/tickets'

    await createNotification({ staffId: candidate.id, type: 'ticket_escalated', title, body, url, ticketId })
    await sendPushToStaff(candidate.id, { title, body, url })
  }

  return loadFullTicket(ticketId)
}
