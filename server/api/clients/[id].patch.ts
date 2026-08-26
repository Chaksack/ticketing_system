import type { ClientStage } from '../../../app/types/client'
import type { ClientRow } from '../../utils/mappers'

interface UpdateClientBody {
  name?: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  stage?: ClientStage
  notes?: string
  assigneeIds?: string[]
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
  const now = new Date().toISOString()

  await db.prepare(`
    UPDATE clients
    SET name = ?, contact_name = ?, contact_email = ?, contact_phone = ?, stage = ?, notes = ?, updated_at = ?
    WHERE id = ?
  `).run(name, contactName, contactEmail, contactPhone, stage, notes, now, id)

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

  if (body.assigneeIds !== undefined) {
    const before = await getClientAssignees(id)
    const beforeIds = new Set(before.map(a => a.id))
    const afterIds = new Set(body.assigneeIds)
    const changed = beforeIds.size !== afterIds.size || [...beforeIds].some(assigneeId => !afterIds.has(assigneeId))

    if (changed) {
      await setClientAssignees(id, body.assigneeIds)
      const after = await getClientAssignees(id)

      await logClientActivity({
        clientId: id,
        type: 'assignee_changed',
        actorId: user.id,
        actorName: user.name,
        toValue: after.length ? after.map(a => a.name).join(', ') : 'Unassigned',
      })
    }
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
