import type { RegardingType } from '../../../app/types/interaction'

export default defineEventHandler(async (event) => {
  await requireBd(event)
  await ensureDb()

  const query = getQuery(event)
  const regardingType = query.regardingType as RegardingType | undefined
  const regardingId = typeof query.regardingId === 'string' ? query.regardingId : undefined

  if (!regardingType || !regardingId) {
    throw createError({ statusCode: 400, statusMessage: 'regardingType and regardingId are required' })
  }

  const orders = await getSalesOrdersForRecord(regardingType, regardingId)
  return { orders }
})
