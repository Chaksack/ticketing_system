import { QUOTA_PERIOD_PATTERN } from '../../../app/types/quota'

export default defineEventHandler(async (event) => {
  await requireBd(event)
  await ensureDb()

  const query = getQuery(event)
  const period = typeof query.period === 'string' ? query.period : undefined

  if (!period || !QUOTA_PERIOD_PATTERN.test(period)) {
    throw createError({ statusCode: 400, statusMessage: 'period is required as YYYY-MM (month) or YYYY (year)' })
  }

  const progress = await getQuotaProgress(period)
  return { progress }
})
