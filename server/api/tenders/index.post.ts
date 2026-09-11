import type { TenderStage } from '../../../app/types/tender'

interface NewTenderBody {
  title?: string
  issuingAuthority?: string
  referenceNumber?: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  source?: string
  stage?: TenderStage
  estimatedValue?: number
  submissionDeadline?: string
  notes?: string
  assigneeIds?: string[]
}

export default defineEventHandler(async (event) => {
  const user = await requireBd(event)

  const body = await readBody<NewTenderBody>(event)

  if (!body?.title) {
    throw createError({ statusCode: 400, statusMessage: 'title is required' })
  }

  await ensureDb()
  const db = useDatabase()

  const id = await nextTenderId()
  const now = new Date().toISOString()

  await db.prepare(`
    INSERT INTO tenders (
      id, title, issuing_authority, reference_number, contact_name, contact_email, contact_phone,
      source, stage, estimated_value, submission_deadline, deadline_reminder_sent, notes,
      created_by, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
  `).run(
    id,
    body.title,
    body.issuingAuthority ?? null,
    body.referenceNumber ?? null,
    body.contactName ?? null,
    body.contactEmail ?? null,
    body.contactPhone ?? null,
    body.source ?? null,
    body.stage ?? 'identified',
    body.estimatedValue ?? null,
    body.submissionDeadline ?? null,
    body.notes ?? null,
    user.id,
    now,
    now,
  )

  await setTenderAssignees(id, body.assigneeIds ?? [])

  let tender = await loadFullTender(id)
  tender = await applyBdCreationRules('tender', tender)

  setResponseStatus(event, 201)
  return { tender }
})
