import type { AutomationField, AutomationOperator } from '../../../app/types/automation'
import type { TicketPriority, TicketStatus } from '../../../app/types/ticket'
import type { AutomationRuleRow } from '../../utils/automation'

interface NewRuleBody {
  name?: string
  field?: AutomationField
  operator?: AutomationOperator
  value?: string
  setPriority?: TicketPriority
  setStatus?: TicketStatus
  setAssigneeId?: string
  addTagId?: string
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const body = await readBody<NewRuleBody>(event)

  if (!body?.name?.trim() || !body?.field || !body?.operator || !body?.value?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'name, field, operator and value are required' })
  }

  await ensureDb()
  const db = useDatabase()

  const id = await nextRuleId()
  const now = new Date().toISOString()

  await db.prepare(`
    INSERT INTO automation_rules (id, name, enabled, field, operator, value, set_priority, set_status, set_assignee_id, add_tag_id, created_at)
    VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, body.name.trim(), body.field, body.operator, body.value.trim(), body.setPriority ?? null, body.setStatus ?? null, body.setAssigneeId ?? null, body.addTagId ?? null, now)

  const row = await db.prepare('SELECT * FROM automation_rules WHERE id = ?').get(id) as AutomationRuleRow

  setResponseStatus(event, 201)
  return { rule: mapAutomationRuleRow(row) }
})
