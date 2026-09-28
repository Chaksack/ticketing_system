import type { ProjectStatus } from '../../../app/types/project'
import type { ProjectRow } from '../../utils/mappers'
import { isProjectCurrency, PROJECT_CURRENCIES } from '../../../app/types/project'

interface UpdateProjectBody {
  name?: string
  description?: string | null
  status?: ProjectStatus
  startDate?: string | null
  endDate?: string | null
  contractValue?: number | null
  currency?: string
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
  if (body.contractValue !== undefined && body.contractValue !== null && (!Number.isFinite(Number(body.contractValue)) || Number(body.contractValue) < 0)) {
    throw createError({ statusCode: 400, statusMessage: 'contractValue must be a non-negative number' })
  }
  const contractValue = body.contractValue !== undefined ? (body.contractValue === null ? null : Number(body.contractValue)) : existing.contract_value ?? null
  if (body.currency !== undefined && !isProjectCurrency(body.currency?.trim().toUpperCase())) {
    throw createError({ statusCode: 400, statusMessage: `currency must be one of ${PROJECT_CURRENCIES.map(c => c.code).join(', ')}` })
  }
  const currency = body.currency?.trim().toUpperCase() || existing.currency || 'GHS'
  const now = new Date().toISOString()

  await db.prepare(`
    UPDATE projects
    SET name = ?, description = ?, status = ?, start_date = ?, end_date = ?, contract_value = ?, currency = ?, updated_at = ?
    WHERE id = ?
  `).run(name, description, status, startDate, endDate, contractValue, currency, now, id)

  const project = await loadFullProject(id)
  return { project }
})
