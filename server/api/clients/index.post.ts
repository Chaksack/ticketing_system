import type { ClientStage } from '../../../app/types/client'

interface NewClientBody {
  name?: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  stage?: ClientStage
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
    INSERT INTO clients (id, name, contact_name, contact_email, contact_phone, stage, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    body.name,
    body.contactName ?? null,
    body.contactEmail ?? null,
    body.contactPhone ?? null,
    body.stage ?? 'lead',
    body.notes ?? null,
    now,
    now,
  )

  await setClientAssignees(id, body.assigneeIds ?? [])

  const client = await loadFullClient(id)

  setResponseStatus(event, 201)
  return { client }
})
