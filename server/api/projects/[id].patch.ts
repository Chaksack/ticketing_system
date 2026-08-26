import type { ProjectStatus } from '../../../app/types/project'
import type { ProjectRow } from '../../utils/mappers'

interface UpdateProjectBody {
  name?: string
  description?: string | null
  status?: ProjectStatus
  startDate?: string | null
  endDate?: string | null
}

export default defineEventHandler(async (event) => {
  await requireBd(event)

  const id = getRouterParam(event, 'id')
  const body = await readBody<UpdateProjectBody>(event)

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing project id' })
  }

  await ensureDb()
  const db = useDatabase()

  const existing = await db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow | undefined
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Project not found' })
  }

  const name = body.name ?? existing.name
  const description = body.description !== undefined ? body.description : existing.description
  const status = body.status ?? existing.status as ProjectStatus
  const startDate = body.startDate !== undefined ? body.startDate : existing.start_date
  const endDate = body.endDate !== undefined ? body.endDate : existing.end_date
  const now = new Date().toISOString()

  await db.prepare(`
    UPDATE projects
    SET name = ?, description = ?, status = ?, start_date = ?, end_date = ?, updated_at = ?
    WHERE id = ?
  `).run(name, description, status, startDate, endDate, now, id)

  const project = await loadFullProject(id)
  return { project }
})
