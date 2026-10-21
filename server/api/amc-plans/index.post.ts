import type { AmcPlanRow } from '../../utils/mappers'

interface NewAmcPlanBody {
  name?: string
  description?: string
  defaultDurationMonths?: number
  price?: number
  currency?: string
  slaTargets?: unknown
}

export default defineEventHandler(async (event) => {
  await requireBd(event)

  const body = await readBody<NewAmcPlanBody>(event)

  if (!body?.name) {
    throw createError({ statusCode: 400, statusMessage: 'name is required' })
  }

  await ensureDb()
  const db = useTenantDb()

  const id = await nextAmcPlanId()
  const now = new Date().toISOString()

  await db.prepare(`
    INSERT INTO amc_plans (id, name, description, default_duration_months, price, currency, sla_targets, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, body.name, body.description ?? null, body.defaultDurationMonths ?? 12, body.price ?? null, body.currency ?? 'GHS', cleanSlaTargets(body.slaTargets), now)

  const row = await db.prepare('SELECT * FROM amc_plans WHERE id = ?').get(id) as AmcPlanRow

  setResponseStatus(event, 201)
  return { plan: mapAmcPlanRow(row) }
})
