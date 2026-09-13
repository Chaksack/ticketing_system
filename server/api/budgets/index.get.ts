export default defineEventHandler(async (event) => {
  await requireFinance(event)
  await ensureDb()

  const query = getQuery(event)
  const periodId = typeof query.periodId === 'string' && query.periodId ? query.periodId : undefined

  const budgets = await getAllBudgets(periodId)
  return { budgets }
})
