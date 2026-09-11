import type { BdEntityType, BdRuleField, BdRuleOperator, BdRuleTrigger } from '../../../app/types/automation'
import type { BdAutomationRuleRow } from '../../utils/bdAutomation'

interface NewBdRuleBody {
  name?: string
  entityType?: BdEntityType
  trigger?: BdRuleTrigger
  field?: BdRuleField
  operator?: BdRuleOperator
  value?: string
  toStage?: string
  setAssigneeId?: string
  notifyStaffId?: string
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const body = await readBody<NewBdRuleBody>(event)

  if (!body?.name?.trim() || !body?.entityType || !body?.trigger) {
    throw createError({ statusCode: 400, statusMessage: 'name, entityType and trigger are required' })
  }

  if (body.trigger === 'created' && (!body.field || !body.operator || !body.value?.trim())) {
    throw createError({ statusCode: 400, statusMessage: 'field, operator and value are required for an on-create rule' })
  }

  if (body.trigger === 'stage_changed' && !body.toStage) {
    throw createError({ statusCode: 400, statusMessage: 'toStage is required for a stage-changed rule' })
  }

  if (!body.setAssigneeId && !body.notifyStaffId) {
    throw createError({ statusCode: 400, statusMessage: 'Choose at least one action — assign to, or notify' })
  }

  await ensureDb()
  const db = useDatabase()

  const id = await nextBdAutomationRuleId()
  const now = new Date().toISOString()

  await db.prepare(`
    INSERT INTO bd_automation_rules (id, entity_type, trigger, field, operator, value, to_stage, set_assignee_id, notify_staff_id, enabled, name, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(
    id,
    body.entityType,
    body.trigger,
    body.trigger === 'created' ? body.field : null,
    body.trigger === 'created' ? body.operator : null,
    body.trigger === 'created' ? body.value!.trim() : null,
    body.trigger === 'stage_changed' ? body.toStage : null,
    body.setAssigneeId ?? null,
    body.notifyStaffId ?? null,
    body.name.trim(),
    now,
  )

  const row = await db.prepare('SELECT * FROM bd_automation_rules WHERE id = ?').get(id) as BdAutomationRuleRow

  setResponseStatus(event, 201)
  return { rule: mapBdAutomationRuleRow(row) }
})
