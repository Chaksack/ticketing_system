export default defineEventHandler(async (event) => {
  await requireBd(event)
  await ensureDb()

  const query = getQuery(event)
  const period = typeof query.period === 'string' ? query.period : undefined

  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    throw createError({ statusCode: 400, statusMessage: 'period is required in YYYY-MM format' })
  }

  const progress = await getQuotaProgress(period)
  return { progress }
})
