import type { RegardingType } from '../../../app/types/interaction'

const REGARDING_TYPES: RegardingType[] = ['lead', 'tender', 'client']

export default defineEventHandler(async (event) => {
  await requireSessionUser(event)
  await ensureDb()

  const query = getQuery(event)
  const regardingType = query.regardingType
  const regardingId = query.regardingId

  if (typeof regardingType !== 'string' || !REGARDING_TYPES.includes(regardingType as RegardingType)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid regardingType' })
  }
  if (typeof regardingId !== 'string' || !regardingId) {
    throw createError({ statusCode: 400, statusMessage: 'regardingId is required' })
  }

  const suggestion = await getOpportunitySuggestion(regardingType as RegardingType, regardingId)
  return { suggestion }
})
