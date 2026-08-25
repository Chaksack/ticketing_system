import type { AmcPlanRow } from '../../utils/mappers'

export default defineEventHandler(async (event) => {
  await requireBd(event)
  await ensureDb()

  const db = useDatabase()
  const rows = await db.prepare('SELECT * FROM amc_plans ORDER BY name ASC').all() as AmcPlanRow[]

  return { plans: rows.map(row => mapAmcPlanRow(row)) }
})
