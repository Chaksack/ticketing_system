export default defineEventHandler(async (event) => {
  await requireFinance(event)
  await ensureDb()

  const query = getQuery(event)
  const now = new Date()
  // Default to month-to-date — a plain date range, not resolveOpenPeriodForDate(), since that
  // throws on a closed period and this is a read-only report, not a posting.
  const defaultFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()

  const from = typeof query.from === 'string' && query.from ? query.from : defaultFrom
  const to = typeof query.to === 'string' && query.to ? query.to : now.toISOString()

  return buildIncomeStatement(from, to)
})
