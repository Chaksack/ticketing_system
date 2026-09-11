import type { BdQuotaRow } from '../../utils/quotas'

export default defineEventHandler(async (event) => {
  await requireBd(event)
  await ensureDb()

  const query = getQuery(event)
  const period = typeof query.period === 'string' ? query.period : undefined

  if (!period) {
    throw createError({ statusCode: 400, statusMessage: 'period is required' })
  }

  const db = useDatabase()
  const rows = await db.prepare(`
    SELECT bd_quotas.*, staff.name AS staff_name
    FROM bd_quotas
    JOIN staff ON staff.id = bd_quotas.staff_id
    WHERE bd_quotas.period = ?
    ORDER BY staff.name ASC
  `).all(period) as BdQuotaRow[]

  return { quotas: rows.map(row => mapBdQuotaRow(row)) }
})
