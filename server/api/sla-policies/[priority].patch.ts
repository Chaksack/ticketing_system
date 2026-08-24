import type { SlaPolicyRow } from '../../utils/sla'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const priority = getRouterParam(event, 'priority')
  const body = await readBody<{ firstResponseMins?: number, resolutionMins?: number }>(event)

  if (!priority) {
    throw createError({ statusCode: 400, statusMessage: 'Missing priority' })
  }

  await ensureDb()
  const db = useDatabase()

  const existing = await db.prepare('SELECT * FROM sla_policies WHERE priority = ?').get(priority) as SlaPolicyRow | undefined
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'SLA policy not found' })
  }

  const firstResponseMins = body.firstResponseMins ?? existing.first_response_mins
  const resolutionMins = body.resolutionMins ?? existing.resolution_mins

  if (firstResponseMins <= 0 || resolutionMins <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Targets must be positive numbers of minutes' })
  }

  await db.prepare('UPDATE sla_policies SET first_response_mins = ?, resolution_mins = ? WHERE priority = ?')
    .run(firstResponseMins, resolutionMins, priority)

  const row = await db.prepare('SELECT * FROM sla_policies WHERE priority = ?').get(priority) as SlaPolicyRow
  return { policy: mapSlaPolicyRow(row) }
})
