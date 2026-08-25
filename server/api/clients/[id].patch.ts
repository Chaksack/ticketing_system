import type { ClientStage } from '../../../app/types/client'
import type { ClientRow } from '../../utils/mappers'

interface UpdateClientBody {
  name?: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  stage?: ClientStage
  notes?: string
  assignedTo?: string | null
}

const STAGE_LABELS: Record<ClientStage, string> = {
  lead: 'Lead',
  contacted: 'Contacted',
  proposal: 'Proposal Sent',
  negotiation: 'Negotiation',
  active: 'Active',
  lost: 'Lost',
}

export default defineEventHandler(async (event) => {
  const user = await requireBd(event)

  const id = getRouterParam(event, 'id')
  const body = await readBody<UpdateClientBody>(event)

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing client id' })
  }

  await ensureDb()
  const db = useDatabase()

  const existing = await db.prepare('SELECT * FROM clients WHERE id = ?').get(id) as ClientRow | undefined
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Client not found' })
  }

  const name = body.name ?? existing.name
  const contactName = body.contactName !== undefined ? body.contactName : existing.contact_name
  const contactEmail = body.contactEmail !== undefined ? body.contactEmail : existing.contact_email
  const contactPhone = body.contactPhone !== undefined ? body.contactPhone : existing.contact_phone
  const stage = body.stage ?? existing.stage as ClientStage
  const notes = body.notes !== undefined ? body.notes : existing.notes
  const assignedTo = body.assignedTo !== undefined ? body.assignedTo : existing.assigned_to
  const now = new Date().toISOString()

  await db.prepare(`
    UPDATE clients
    SET name = ?, contact_name = ?, contact_email = ?, contact_phone = ?, stage = ?, notes = ?, assigned_to = ?, updated_at = ?
    WHERE id = ?
  `).run(name, contactName, contactEmail, contactPhone, stage, notes, assignedTo, now, id)

  if (stage !== existing.stage) {
    await logClientActivity({
      clientId: id,
      type: 'stage_changed',
      actorId: user.id,
      actorName: user.name,
      fromValue: STAGE_LABELS[existing.stage as ClientStage],
      toValue: STAGE_LABELS[stage],
    })
  }

  if (assignedTo !== existing.assigned_to) {
    let assigneeName: string | undefined
    if (assignedTo) {
      const staffRow = await db.prepare('SELECT name FROM staff WHERE id = ?').get(assignedTo) as { name: string } | undefined
      assigneeName = staffRow?.name
    }

    await logClientActivity({
      clientId: id,
      type: 'assignee_changed',
      actorId: user.id,
      actorName: user.name,
      toValue: assigneeName ?? 'Unassigned',
    })
  }

  if (body.notes !== undefined && body.notes !== existing.notes) {
    await logClientActivity({
      clientId: id,
      type: 'note_updated',
      actorId: user.id,
      actorName: user.name,
    })
  }

  const client = await loadFullClient(id)
  return { client }
})
