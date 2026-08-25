import type { AutomationRule } from '../../app/types/automation'
import type { Ticket } from '../../app/types/ticket'
import type { StaffRow } from './mappers'

export interface AutomationRuleRow {
  id: string
  name: string
  enabled: number
  field: string
  operator: string
  value: string
  set_priority: string | null
  set_status: string | null
  set_assignee_id: string | null
  add_tag_id: string | null
  created_at: string
}

export function mapAutomationRuleRow(row: AutomationRuleRow): AutomationRule {
  return {
    id: row.id,
    name: row.name,
    enabled: !!row.enabled,
    field: row.field as AutomationRule['field'],
    operator: row.operator as AutomationRule['operator'],
    value: row.value,
    setPriority: row.set_priority as AutomationRule['setPriority'] ?? undefined,
    setStatus: row.set_status as AutomationRule['setStatus'] ?? undefined,
    setAssigneeId: row.set_assignee_id ?? undefined,
    addTagId: row.add_tag_id ?? undefined,
    createdAt: row.created_at,
  }
}

function matchesRule(ticket: Ticket, rule: AutomationRule): boolean {
  const fieldValue = (rule.field === 'category' ? ticket.category : ticket.subject).toLowerCase()
  const ruleValue = rule.value.toLowerCase()

  return rule.operator === 'equals' ? fieldValue === ruleValue : fieldValue.includes(ruleValue)
}

/**
 * Evaluates enabled automation rules against a newly created ticket and applies the
 * first match's field changes. Only runs at creation time to avoid update-triggered loops.
 */
export async function applyAutomationRules(ticket: Ticket): Promise<Ticket> {
  const db = useDatabase()

  const ruleRows = await db.prepare('SELECT * FROM automation_rules WHERE enabled = 1 ORDER BY created_at ASC').all() as AutomationRuleRow[]
  const rule = ruleRows.map(mapAutomationRuleRow).find(r => matchesRule(ticket, r))

  if (!rule)
    return ticket

  const status = rule.setStatus ?? ticket.status
  const priority = rule.setPriority ?? ticket.priority
  const assigneeId = rule.setAssigneeId ?? ticket.assigneeId ?? null

  await db.prepare('UPDATE tickets SET status = ?, priority = ?, assignee_id = ? WHERE id = ?')
    .run(status, priority, assigneeId, ticket.id)

  if (rule.addTagId) {
    await db.prepare('INSERT INTO ticket_tags (ticket_id, tag_id) VALUES (?, ?) ON CONFLICT DO NOTHING')
      .run(ticket.id, rule.addTagId)
  }

  await logTicketActivity({
    ticketId: ticket.id,
    type: 'automation_applied',
    actorName: 'Automation',
    message: `Rule "${rule.name}" applied`,
  })

  return loadFullTicket(ticket.id)
}

/**
 * Assigns the ticket to the active staff member currently carrying the fewest
 * open/in-progress assigned tickets. No-op if the ticket already has an assignee
 * (e.g. set by an automation rule) or no active staff exist.
 */
export async function autoAssign(ticket: Ticket): Promise<Ticket> {
  if (ticket.assigneeId)
    return ticket

  const db = useDatabase()

  const candidate = await db.prepare(`
    SELECT staff.*, COALESCE(load.open_count, 0) AS open_count
    FROM staff
    LEFT JOIN (
      SELECT assignee_id, COUNT(*) AS open_count
      FROM tickets
      WHERE assignee_id IS NOT NULL AND status IN ('open', 'in-progress')
      GROUP BY assignee_id
    ) load ON load.assignee_id = staff.id
    WHERE staff.status = 'active'
    ORDER BY open_count ASC, staff.created_at ASC
    LIMIT 1
  `).get() as (StaffRow & { open_count: number }) | undefined

  if (!candidate)
    return ticket

  await db.prepare('UPDATE tickets SET assignee_id = ? WHERE id = ?').run(candidate.id, ticket.id)

  await logTicketActivity({
    ticketId: ticket.id,
    type: 'auto_assigned',
    actorName: 'Automation',
    toValue: candidate.name,
    message: `Auto-assigned to ${candidate.name}`,
  })

  await sendPushToStaff(candidate.id, {
    title: 'New ticket assigned to you',
    body: `[${ticket.priority.toUpperCase()}] ${ticket.id}: ${ticket.subject}`,
    url: '/tickets',
  })

  return loadFullTicket(ticket.id)
}
