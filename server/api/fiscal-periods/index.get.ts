import type { FiscalPeriodRow } from '../../utils/fiscalPeriods'

export default defineEventHandler(async (event) => {
  await requireFinance(event)
  await ensureDb()

  const db = useDatabase()
  const rows = await db.prepare('SELECT * FROM fiscal_periods ORDER BY id DESC').all() as FiscalPeriodRow[]

  return { periods: rows.map(row => mapFiscalPeriodRow(row)) }
})
