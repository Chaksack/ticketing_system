import type { LeadStage } from '../../../app/types/lead'
import type { LeadRow } from '../../utils/mappers'

interface UpdateLeadBody {
  name?: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  source?: string
  stage?: LeadStage
  notes?: string
  assigneeIds?: string[]
  nextStep?: string | null
  nextStepAt?: string | null
}

const STAGE_LABELS: Record<LeadStage, string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  proposal: 'Proposal Sent',
  won: 'Won',
  lost: 'Lost',
}

export default defineEventHandler(async (event) => {
  const user = await requireBd(event)

  const id = getRouterParam(event, 'id')
  const body = await readBody<UpdateLeadBody>(event)

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing lead id' })
  }

  await ensureDb()
  const db = useDatabase()

  const existing = await db.prepare('SELECT * FROM leads WHERE id = ?').get(id) as LeadRow | undefined
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Lead not found' })
  }

  const name = body.name ?? existing.name
  const contactName = body.contactName !== undefined ? body.contactName : existing.contact_name
  const contactEmail = body.contactEmail !== undefined ? body.contactEmail : existing.contact_email
  const contactPhone = body.contactPhone !== undefined ? body.contactPhone : existing.contact_phone
  const source = body.source !== undefined ? body.source : existing.source
  const stage = body.stage ?? existing.stage as LeadStage
  const notes = body.notes !== undefined ? body.notes : existing.notes
  const nextStep = body.nextStep !== undefined ? body.nextStep : existing.next_step
  const nextStepAt = body.nextStepAt !== undefined ? body.nextStepAt : existing.next_step_at
  // Changing the reminder time re-arms it so a new push can fire for the new time.
  const nextStepReminderSent = body.nextStepAt !== undefined && body.nextStepAt !== existing.next_step_at ? 0 : existing.next_step_reminder_sent
  const now = new Date().toISOString()

  await db.prepare(`
    UPDATE leads
    SET name = ?, contact_name = ?, contact_email = ?, contact_phone = ?, source = ?, stage = ?, notes = ?,
        next_step = ?, next_step_at = ?, next_step_reminder_sent = ?, updated_at = ?
    WHERE id = ?
  `).run(name, contactName, contactEmail, contactPhone, source, stage, notes, nextStep, nextStepAt, nextStepReminderSent, now, id)

  if (stage !== existing.stage) {
    await logLeadActivity({
      leadId: id,
      type: 'stage_changed',
      actorId: user.id,
      actorName: user.name,
      fromValue: STAGE_LABELS[existing.stage as LeadStage],
      toValue: STAGE_LABELS[stage],
    })
  }

  if (body.assigneeIds !== undefined) {
    const before = await getLeadAssignees(id)
    const beforeIds = new Set(before.map(a => a.id))
    const afterIds = new Set(body.assigneeIds)
    const changed = beforeIds.size !== afterIds.size || [...beforeIds].some(assigneeId => !afterIds.has(assigneeId))

    if (changed) {
      await setLeadAssignees(id, body.assigneeIds)
      const after = await getLeadAssignees(id)

      await logLeadActivity({
        leadId: id,
        type: 'assignee_changed',
        actorId: user.id,
        actorName: user.name,
        toValue: after.length ? after.map(a => a.name).join(', ') : 'Unassigned',
      })
    }
  }

  if (body.notes !== undefined && body.notes !== existing.notes) {
    await logLeadActivity({
      leadId: id,
      type: 'note_updated',
      actorId: user.id,
      actorName: user.name,
    })
  }

  if ((body.nextStep !== undefined && body.nextStep !== existing.next_step) || (body.nextStepAt !== undefined && body.nextStepAt !== existing.next_step_at)) {
    await logLeadActivity({
      leadId: id,
      type: 'next_step_updated',
      actorId: user.id,
      actorName: user.name,
      toValue: nextStep ?? undefined,
    })
  }

  const lead = await loadFullLead(id)
  return { lead }
})
