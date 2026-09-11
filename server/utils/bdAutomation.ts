import type { BdAutomationRule, BdEntityType } from '../../app/types/automation'
import type { Lead } from '../../app/types/lead'
import type { Tender } from '../../app/types/tender'
import type { StaffRow } from './mappers'
import { parseStaffRoles } from './mappers'

export interface BdAutomationRuleRow {
  id: string
  entity_type: string
  trigger: string
  field: string | null
  operator: string | null
  value: string | null
  to_stage: string | null
  set_assignee_id: string | null
  notify_staff_id: string | null
  enabled: number
  name: string
  created_at: string
}

export function mapBdAutomationRuleRow(row: BdAutomationRuleRow): BdAutomationRule {
  return {
    id: row.id,
    entityType: row.entity_type as BdEntityType,
    trigger: row.trigger as BdAutomationRule['trigger'],
    name: row.name,
    enabled: !!row.enabled,
    field: (row.field as BdAutomationRule['field']) ?? undefined,
    operator: (row.operator as BdAutomationRule['operator']) ?? undefined,
    value: row.value ?? undefined,
    toStage: row.to_stage ?? undefined,
    setAssigneeId: row.set_assignee_id ?? undefined,
    notifyStaffId: row.notify_staff_id ?? undefined,
    createdAt: row.created_at,
  }
}

type BdRecord = Lead | Tender

function matchesCreationRule(record: BdRecord, rule: BdAutomationRule): boolean {
  if (!rule.value)
    return false

  const fieldValue = (record.source ?? '').toLowerCase()
  const ruleValue = rule.value.toLowerCase()

  return rule.operator === 'equals' ? fieldValue === ruleValue : fieldValue.includes(ruleValue)
}

/**
 * Evaluates enabled 'created' rules for the given entity type against a newly created
 * lead/tender and applies the first match's assignee. Mirrors applyAutomationRules() in
 * automation.ts, only running at creation time to avoid update-triggered loops.
 */
export async function applyBdCreationRules(entityType: 'lead', record: Lead): Promise<Lead>
export async function applyBdCreationRules(entityType: 'tender', record: Tender): Promise<Tender>
export async function applyBdCreationRules(entityType: BdEntityType, record: BdRecord): Promise<BdRecord> {
  const db = useDatabase()

  const ruleRows = await db.prepare(
    'SELECT * FROM bd_automation_rules WHERE enabled = 1 AND entity_type = ? AND trigger = \'created\' ORDER BY created_at ASC',
  ).all(entityType) as BdAutomationRuleRow[]

  const rule = ruleRows.map(mapBdAutomationRuleRow).find(r => matchesCreationRule(record, r))
  if (!rule)
    return record

  if (rule.setAssigneeId && !record.assignees.length) {
    if (entityType === 'lead') {
      await setLeadAssignees(record.id, [rule.setAssigneeId])
      await logLeadActivity({
        leadId: record.id,
        type: 'automation_applied',
        actorName: 'Automation',
        message: `Rule "${rule.name}" applied`,
      })
      return loadFullLead(record.id)
    }

    await setTenderAssignees(record.id, [rule.setAssigneeId])
    await logTenderActivity({
      tenderId: record.id,
      type: 'automation_applied',
      actorName: 'Automation',
      message: `Rule "${rule.name}" applied`,
    })
    return loadFullTender(record.id)
  }

  return record
}

/**
 * Evaluates enabled 'stage_changed' rules matching the record's current stage and notifies
 * (and optionally reassigns) the configured staff member. Called after a stage change is
 * committed and logged.
 */
export async function applyBdStageChangeRules(entityType: 'lead', record: Lead): Promise<Lead>
export async function applyBdStageChangeRules(entityType: 'tender', record: Tender): Promise<Tender>
export async function applyBdStageChangeRules(entityType: BdEntityType, record: BdRecord): Promise<BdRecord> {
  const db = useDatabase()

  const ruleRows = await db.prepare(
    'SELECT * FROM bd_automation_rules WHERE enabled = 1 AND entity_type = ? AND trigger = \'stage_changed\' AND to_stage = ? ORDER BY created_at ASC',
  ).all(entityType, record.stage) as BdAutomationRuleRow[]

  if (!ruleRows.length)
    return record

  const label = entityType === 'lead' ? (record as Lead).name : (record as Tender).title
  const url = entityType === 'lead' ? `/leads?open=${record.id}` : `/tenders?open=${record.id}`
  let changed = false

  for (const rule of ruleRows.map(mapBdAutomationRuleRow)) {
    if (rule.setAssigneeId) {
      if (entityType === 'lead')
        await setLeadAssignees(record.id, [rule.setAssigneeId])
      else
        await setTenderAssignees(record.id, [rule.setAssigneeId])
      changed = true
    }

    if (rule.notifyStaffId) {
      const title = `${label} entered ${record.stage}`
      const body = `Rule "${rule.name}" fired for ${entityType} ${record.id}`

      await createNotification({
        staffId: rule.notifyStaffId,
        type: 'bd_automation',
        title,
        body,
        url,
        leadId: entityType === 'lead' ? record.id : undefined,
      })
      await sendPushToStaff(rule.notifyStaffId, { title, body, url })
    }

    if (rule.setAssigneeId || rule.notifyStaffId) {
      if (entityType === 'lead') {
        await logLeadActivity({
          leadId: record.id,
          type: 'automation_applied',
          actorName: 'Automation',
          message: `Rule "${rule.name}" applied`,
        })
      }
      else {
        await logTenderActivity({
          tenderId: record.id,
          type: 'automation_applied',
          actorName: 'Automation',
          message: `Rule "${rule.name}" applied`,
        })
      }
    }
  }

  if (!changed)
    return record

  return entityType === 'lead' ? loadFullLead(record.id) : loadFullTender(record.id)
}

/**
 * Assigns a newly created lead to the active 'bd'-role staff member currently carrying the
 * fewest leads in a non-terminal stage. No-op if the lead already has an assignee (e.g. set
 * by a creation rule above) or no active bd staff exist. Mirrors autoAssign() in automation.ts.
 */
export async function autoAssignLead(lead: Lead): Promise<Lead> {
  if (lead.assignees.length)
    return lead

  const db = useDatabase()

  const staffRows = await db.prepare('SELECT * FROM staff WHERE status = \'active\'').all() as StaffRow[]
  const candidates = staffRows.filter(row => parseStaffRoles(row).includes('bd'))
  if (!candidates.length)
    return lead

  const loadRows = await db.prepare(`
    SELECT lead_assignees.staff_id, COUNT(*) AS open_count
    FROM lead_assignees
    JOIN leads ON leads.id = lead_assignees.lead_id
    WHERE leads.stage NOT IN ('won', 'lost')
    GROUP BY lead_assignees.staff_id
  `).all() as { staff_id: string, open_count: number | string }[]
  const loadById = new Map(loadRows.map(row => [row.staff_id, Number(row.open_count)]))

  const candidate = [...candidates].sort((a, b) => (loadById.get(a.id) ?? 0) - (loadById.get(b.id) ?? 0) || a.created_at.localeCompare(b.created_at))[0]!

  await setLeadAssignees(lead.id, [candidate.id])

  await logLeadActivity({
    leadId: lead.id,
    type: 'automation_applied',
    actorName: 'Automation',
    toValue: candidate.name,
    message: `Auto-assigned to ${candidate.name}`,
  })

  await sendPushToStaff(candidate.id, {
    title: 'New lead assigned to you',
    body: `${lead.name} was auto-assigned to you`,
    url: '/leads',
  })

  return loadFullLead(lead.id)
}
