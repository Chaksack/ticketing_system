import type { AmcPlanRow } from '../../utils/mappers'

interface UpdateAmcPlanBody {
  name?: string
  description?: string
  defaultDurationMonths?: number
  price?: number
  currency?: string
}

export default defineEventHandler(async (event) => {
  await requireBd(event)

  const id = getRouterParam(event, 'id')
  const body = await readBody<UpdateAmcPlanBody>(event)

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing plan id' })
  }

  await ensureDb()
  const db = useDatabase()

  const existing = await db.prepare('SELECT * FROM amc_plans WHERE id = ?').get(id) as AmcPlanRow | undefined
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Plan not found' })
  }

  const name = body.name ?? existing.name
  const description = body.description !== undefined ? body.description : existing.description
  const defaultDurationMonths = body.defaultDurationMonths ?? existing.default_duration_months
  const price = body.price !== undefined ? body.price : existing.price
  const currency = body.currency ?? existing.currency

  await db.prepare('UPDATE amc_plans SET name = ?, description = ?, default_duration_months = ?, price = ?, currency = ? WHERE id = ?')
    .run(name, description, defaultDurationMonths, price, currency, id)

  const row = await db.prepare('SELECT * FROM amc_plans WHERE id = ?').get(id) as AmcPlanRow
  return { plan: mapAmcPlanRow(row) }
})
