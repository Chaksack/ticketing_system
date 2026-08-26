import type { AmcContractStatus } from '../../../../app/types/amc'
import type { AmcPlanRow, ProjectRow } from '../../../utils/mappers'

interface NewContractBody {
  planId?: string
  startDate?: string
  endDate?: string
  status?: AmcContractStatus
}

export default defineEventHandler(async (event) => {
  const user = await requireBd(event)

  const projectId = getRouterParam(event, 'id')
  const body = await readBody<NewContractBody>(event)

  if (!projectId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing project id' })
  }

  if (!body?.planId || !body?.startDate || !body?.endDate) {
    throw createError({ statusCode: 400, statusMessage: 'planId, startDate and endDate are required' })
  }

  if (new Date(body.endDate).getTime() <= new Date(body.startDate).getTime()) {
    throw createError({ statusCode: 400, statusMessage: 'endDate must be after startDate' })
  }

  await ensureDb()
  const db = useDatabase()

  const project = await db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as ProjectRow | undefined
  if (!project) {
    throw createError({ statusCode: 404, statusMessage: 'Project not found' })
  }

  const plan = await db.prepare('SELECT * FROM amc_plans WHERE id = ?').get(body.planId) as AmcPlanRow | undefined
  if (!plan) {
    throw createError({ statusCode: 404, statusMessage: 'AMC plan not found' })
  }

  const id = await nextContractId()
  const now = new Date().toISOString()

  await db.prepare(`
    INSERT INTO client_amc_contracts (id, client_id, project_id, plan_id, start_date, end_date, status, reminder_30d_sent, reminder_7d_sent, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?)
  `).run(id, project.client_id, projectId, body.planId, body.startDate, body.endDate, body.status ?? 'submitted', now)

  await logClientActivity({
    clientId: project.client_id,
    type: 'amc_assigned',
    actorId: user.id,
    actorName: user.name,
    message: `Assigned "${plan.name}" to project "${project.name}" from ${body.startDate.slice(0, 10)} to ${body.endDate.slice(0, 10)}`,
  })
  await touchClient(project.client_id)

  const updatedProject = await loadFullProject(projectId)
  return { project: updatedProject }
})
