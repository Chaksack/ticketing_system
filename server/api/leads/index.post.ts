import type { LeadStage } from '../../../app/types/lead'

interface NewLeadBody {
  name?: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  source?: string
  stage?: LeadStage
  notes?: string
  assignedTo?: string
}

export default defineEventHandler(async (event) => {
  await requireBd(event)

  const body = await readBody<NewLeadBody>(event)

  if (!body?.name) {
    throw createError({ statusCode: 400, statusMessage: 'name is required' })
  }

  await ensureDb()
  const db = useDatabase()

  const id = await nextLeadId()
  const now = new Date().toISOString()

  await db.prepare(`
    INSERT INTO leads (id, name, contact_name, contact_email, contact_phone, source, stage, notes, assigned_to, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    body.name,
    body.contactName ?? null,
    body.contactEmail ?? null,
    body.contactPhone ?? null,
    body.source ?? null,
    body.stage ?? 'new',
    body.notes ?? null,
    body.assignedTo ?? null,
    now,
    now,
  )

  const lead = await loadFullLead(id)

  setResponseStatus(event, 201)
  return { lead }
})
