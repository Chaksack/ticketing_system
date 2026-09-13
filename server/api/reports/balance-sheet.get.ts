export default defineEventHandler(async (event) => {
  await requireFinance(event)
  await ensureDb()

  const query = getQuery(event)
  const asOf = typeof query.asOf === 'string' && query.asOf ? query.asOf : new Date().toISOString()

  return buildBalanceSheet(asOf)
})
