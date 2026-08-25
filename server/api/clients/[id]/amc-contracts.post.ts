import type { AmcPlanRow, ClientRow } from '../../../utils/mappers'

interface NewContractBody {
  planId?: string
  startDate?: string
  endDate?: string
}

export default defineEventHandler(async (event) => {
  const user = await requireBd(event)

  const clientId = getRouterParam(event, 'id')
  const body = await readBody<NewContractBody>(event)

  if (!clientId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing client id' })
  }

  if (!body?.planId || !body?.startDate || !body?.endDate) {
    throw createError({ statusCode: 400, statusMessage: 'planId, startDate and endDate are required' })
  }

  if (new Date(body.endDate).getTime() <= new Date(body.startDate).getTime()) {
    throw createError({ statusCode: 400, statusMessage: 'endDate must be after startDate' })
  }

  await ensureDb()
  const db = useDatabase()

  const client = await db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId) as ClientRow | undefined
  if (!client) {
    throw createError({ statusCode: 404, statusMessage: 'Client not found' })
  }

  const plan = await db.prepare('SELECT * FROM amc_plans WHERE id = ?').get(body.planId) as AmcPlanRow | undefined
  if (!plan) {
    throw createError({ statusCode: 404, statusMessage: 'AMC plan not found' })
  }

  const id = await nextContractId()
  const now = new Date().toISOString()

  await db.prepare(`
    INSERT INTO client_amc_contracts (id, client_id, plan_id, start_date, end_date, status, reminder_30d_sent, reminder_7d_sent, created_at)
    VALUES (?, ?, ?, ?, ?, 'active', 0, 0, ?)
  `).run(id, clientId, body.planId, body.startDate, body.endDate, now)

  await logClientActivity({
    clientId,
    type: 'amc_assigned',
    actorId: user.id,
    actorName: user.name,
    message: `Assigned "${plan.name}" from ${body.startDate.slice(0, 10)} to ${body.endDate.slice(0, 10)}`,
  })
  await touchClient(clientId)

  const updatedClient = await loadFullClient(clientId)
  return { client: updatedClient }
})
