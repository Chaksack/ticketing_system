import type { TenderStage } from '../../../app/types/tender'
import type { TenderRow } from '../../utils/mappers'

interface UpdateTenderBody {
  title?: string
  issuingAuthority?: string | null
  referenceNumber?: string | null
  contactName?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  source?: string | null
  stage?: TenderStage
  estimatedValue?: number | null
  submissionDeadline?: string | null
  notes?: string | null
  assigneeIds?: string[]
}

const STAGE_LABELS: Record<TenderStage, string> = {
  identified: 'Identified',
  registered: 'Registered',
  preparing: 'Preparing Bid',
  submitted: 'Submitted',
  evaluation: 'Under Evaluation',
  won: 'Won',
  lost: 'Lost',
}

export default defineEventHandler(async (event) => {
  const user = await requireBd(event)

  const id = getRouterParam(event, 'id')
  const body = await readBody<UpdateTenderBody>(event)

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing tender id' })
  }

  await ensureDb()
  const db = useDatabase()

  const existing = await db.prepare('SELECT * FROM tenders WHERE id = ?').get(id) as TenderRow | undefined
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Tender not found' })
  }

  const title = body.title ?? existing.title
  const issuingAuthority = body.issuingAuthority !== undefined ? body.issuingAuthority : existing.issuing_authority
  const referenceNumber = body.referenceNumber !== undefined ? body.referenceNumber : existing.reference_number
  const contactName = body.contactName !== undefined ? body.contactName : existing.contact_name
  const contactEmail = body.contactEmail !== undefined ? body.contactEmail : existing.contact_email
  const contactPhone = body.contactPhone !== undefined ? body.contactPhone : existing.contact_phone
  const source = body.source !== undefined ? body.source : existing.source
  const stage = body.stage ?? existing.stage as TenderStage
  const estimatedValue = body.estimatedValue !== undefined ? body.estimatedValue : existing.estimated_value
  const submissionDeadline = body.submissionDeadline !== undefined ? body.submissionDeadline : existing.submission_deadline
  const notes = body.notes !== undefined ? body.notes : existing.notes
  // Changing the deadline re-arms the reminder so a new push can fire for the new date.
  const deadlineReminderSent = body.submissionDeadline !== undefined && body.submissionDeadline !== existing.submission_deadline ? 0 : existing.deadline_reminder_sent
  const now = new Date().toISOString()

  const gatedStages: TenderStage[] = ['submitted', 'evaluation', 'won']
  if (gatedStages.includes(stage) && stage !== existing.stage) {
    const documentCount = await db.prepare('SELECT COUNT(*) AS count FROM tender_documents WHERE tender_id = ?').get(id) as { count: number | string }
    if (Number(documentCount.count) === 0) {
      throw createError({ statusCode: 400, statusMessage: 'Attach at least one document before moving this tender past Preparing Bid.' })
    }
  }

  await db.prepare(`
    UPDATE tenders
    SET title = ?, issuing_authority = ?, reference_number = ?, contact_name = ?, contact_email = ?, contact_phone = ?,
        source = ?, stage = ?, estimated_value = ?, submission_deadline = ?, deadline_reminder_sent = ?, notes = ?, updated_at = ?
    WHERE id = ?
  `).run(title, issuingAuthority, referenceNumber, contactName, contactEmail, contactPhone, source, stage, estimatedValue, submissionDeadline, deadlineReminderSent, notes, now, id)

  if (stage !== existing.stage) {
    await logTenderActivity({
      tenderId: id,
      type: 'stage_changed',
      actorId: user.id,
      actorName: user.name,
      fromValue: STAGE_LABELS[existing.stage as TenderStage],
      toValue: STAGE_LABELS[stage],
    })
  }

  if (body.assigneeIds !== undefined) {
    const before = await getTenderAssignees(id)
    const beforeIds = new Set(before.map(a => a.id))
    const afterIds = new Set(body.assigneeIds)
    const changed = beforeIds.size !== afterIds.size || [...beforeIds].some(assigneeId => !afterIds.has(assigneeId))

    if (changed) {
      await setTenderAssignees(id, body.assigneeIds)
      const after = await getTenderAssignees(id)

      await logTenderActivity({
        tenderId: id,
        type: 'assignee_changed',
        actorId: user.id,
        actorName: user.name,
        toValue: after.length ? after.map(a => a.name).join(', ') : 'Unassigned',
      })
    }
  }

  if (body.notes !== undefined && body.notes !== existing.notes) {
    await logTenderActivity({
      tenderId: id,
      type: 'note_updated',
      actorId: user.id,
      actorName: user.name,
    })
  }

  if (body.submissionDeadline !== undefined && body.submissionDeadline !== existing.submission_deadline) {
    await logTenderActivity({
      tenderId: id,
      type: 'deadline_updated',
      actorId: user.id,
      actorName: user.name,
      toValue: submissionDeadline ?? undefined,
    })
  }

  let tender = await loadFullTender(id)
  if (stage !== existing.stage)
    tender = await applyBdStageChangeRules('tender', tender)

  return { tender }
})
