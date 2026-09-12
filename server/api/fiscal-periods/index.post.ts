import type { FiscalPeriodRow } from '../../utils/fiscalPeriods'

interface NewFiscalPeriodBody {
  startDate?: string
  endDate?: string
  label?: string
}

export default defineEventHandler(async (event) => {
  await requireFinance(event)

  const body = await readBody<NewFiscalPeriodBody>(event)

  if (!body?.startDate || !body?.endDate) {
    throw createError({ statusCode: 400, statusMessage: 'startDate and endDate are required' })
  }

  if (new Date(body.endDate).getTime() < new Date(body.startDate).getTime()) {
    throw createError({ statusCode: 400, statusMessage: 'endDate must be on or after startDate' })
  }

  await ensureDb()
  const db = useDatabase()

  const id = body.startDate.slice(0, 7)
  const existing = await db.prepare('SELECT id FROM fiscal_periods WHERE id = ?').get(id)
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: `A fiscal period already exists for ${id}` })
  }

  const label = body.label?.trim() || new Date(body.startDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const now = new Date().toISOString()

  await db.prepare(`
    INSERT INTO fiscal_periods (id, label, start_date, end_date, status, created_at)
    VALUES (?, ?, ?, ?, 'open', ?)
  `).run(id, label, body.startDate, body.endDate, now)

  const row = await db.prepare('SELECT * FROM fiscal_periods WHERE id = ?').get(id) as FiscalPeriodRow

  setResponseStatus(event, 201)
  return { period: mapFiscalPeriodRow(row) }
})
