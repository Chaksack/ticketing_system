const PERIOD_ID_PATTERN = /^\d{4}-\d{2}$/

export default defineEventHandler(async (event) => {
  await requireFinance(event)
  await ensureDb()

  const query = getQuery(event)
  const periodId = typeof query.periodId === 'string' && query.periodId ? query.periodId : new Date().toISOString().slice(0, 7)

  if (!PERIOD_ID_PATTERN.test(periodId)) {
    throw createError({ statusCode: 400, statusMessage: 'periodId must be in YYYY-MM form' })
  }

  const rows = await getBudgetVsActual(periodId)
  return { periodId, rows }
})
