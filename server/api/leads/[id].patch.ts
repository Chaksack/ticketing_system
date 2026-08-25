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
  assignedTo?: string | null
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
  const assignedTo = body.assignedTo !== undefined ? body.assignedTo : existing.assigned_to
  const now = new Date().toISOString()

  await db.prepare(`
    UPDATE leads
    SET name = ?, contact_name = ?, contact_email = ?, contact_phone = ?, source = ?, stage = ?, notes = ?, assigned_to = ?, updated_at = ?
    WHERE id = ?
  `).run(name, contactName, contactEmail, contactPhone, source, stage, notes, assignedTo, now, id)

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

  if (assignedTo !== existing.assigned_to) {
    let assigneeName: string | undefined
    if (assignedTo) {
      const staffRow = await db.prepare('SELECT name FROM staff WHERE id = ?').get(assignedTo) as { name: string } | undefined
      assigneeName = staffRow?.name
    }

    await logLeadActivity({
      leadId: id,
      type: 'assignee_changed',
      actorId: user.id,
      actorName: user.name,
      toValue: assigneeName ?? 'Unassigned',
    })
  }

  if (body.notes !== undefined && body.notes !== existing.notes) {
    await logLeadActivity({
      leadId: id,
      type: 'note_updated',
      actorId: user.id,
      actorName: user.name,
    })
  }

  const lead = await loadFullLead(id)
  return { lead }
})
