import type { ProjectStatus } from '../../../app/types/project'

interface NewProjectBody {
  clientId?: string
  name?: string
  description?: string
  status?: ProjectStatus
  startDate?: string
  endDate?: string
}

export default defineEventHandler(async (event) => {
  const user = await requireBd(event)

  const body = await readBody<NewProjectBody>(event)

  if (!body?.clientId) {
    throw createError({ statusCode: 400, statusMessage: 'clientId is required' })
  }

  if (!body?.name) {
    throw createError({ statusCode: 400, statusMessage: 'name is required' })
  }

  await ensureDb()
  const db = useDatabase()

  const client = await db.prepare('SELECT id FROM clients WHERE id = ?').get(body.clientId)
  if (!client) {
    throw createError({ statusCode: 404, statusMessage: 'Client not found' })
  }

  const id = await nextProjectId()
  const now = new Date().toISOString()

  await db.prepare(`
    INSERT INTO projects (id, client_id, name, description, status, start_date, end_date, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    body.clientId,
    body.name,
    body.description ?? null,
    body.status ?? 'planned',
    body.startDate ?? null,
    body.endDate ?? null,
    user.id,
    now,
    now,
  )

  const project = await loadFullProject(id)

  setResponseStatus(event, 201)
  return { project }
})
