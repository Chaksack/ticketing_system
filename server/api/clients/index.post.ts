import type { ClientStage } from '../../../app/types/client'

interface NewClientBody {
  name?: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  stage?: ClientStage
  estimatedValue?: number
  notes?: string
  assigneeIds?: string[]
}

export default defineEventHandler(async (event) => {
  await requireBd(event)

  const body = await readBody<NewClientBody>(event)

  if (!body?.name) {
    throw createError({ statusCode: 400, statusMessage: 'name is required' })
  }

  await ensureDb()
  const db = useDatabase()

  const id = await nextClientId()
  const now = new Date().toISOString()

  await db.prepare(`
    INSERT INTO clients (id, name, contact_name, contact_email, contact_phone, stage, estimated_value, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    body.name,
    body.contactName ?? null,
    body.contactEmail ?? null,
    body.contactPhone ?? null,
    body.stage ?? 'lead',
    body.estimatedValue ?? null,
    body.notes ?? null,
    now,
    now,
  )

  await setClientAssignees(id, body.assigneeIds ?? [])

  const client = await loadFullClient(id)

  setResponseStatus(event, 201)
  return { client }
})
