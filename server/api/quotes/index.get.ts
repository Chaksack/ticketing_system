import type { RegardingType } from '../../../app/types/interaction'

export default defineEventHandler(async (event) => {
  await requireBd(event)
  await ensureDb()

  const query = getQuery(event)
  const regardingType = query.regardingType
  const regardingId = query.regardingId

  if ((regardingType !== 'lead' && regardingType !== 'tender') || typeof regardingId !== 'string' || !regardingId) {
    throw createError({ statusCode: 400, statusMessage: 'regardingType (lead or tender) and regardingId are required' })
  }

  const quotes = await getQuotesForRecord(regardingType as RegardingType, regardingId)
  return { quotes }
})
