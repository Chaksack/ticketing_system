import type { FiscalPeriodStatus } from '../../../app/types/fiscal-period'
import type { FiscalPeriodRow } from '../../utils/fiscalPeriods'

interface UpdateFiscalPeriodBody {
  status?: FiscalPeriodStatus
}

export default defineEventHandler(async (event) => {
  await requireFinance(event)

  const id = getRouterParam(event, 'id')
  const body = await readBody<UpdateFiscalPeriodBody>(event)

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing fiscal period id' })
  }

  if (body?.status !== 'open' && body?.status !== 'closed') {
    throw createError({ statusCode: 400, statusMessage: 'status must be "open" or "closed"' })
  }

  await ensureDb()
  const db = useDatabase()

  const existing = await db.prepare('SELECT id FROM fiscal_periods WHERE id = ?').get(id)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Fiscal period not found' })
  }

  await db.prepare('UPDATE fiscal_periods SET status = ? WHERE id = ?').run(body.status, id)

  const row = await db.prepare('SELECT * FROM fiscal_periods WHERE id = ?').get(id) as FiscalPeriodRow
  return { period: mapFiscalPeriodRow(row) }
})
