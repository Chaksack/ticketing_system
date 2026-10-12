export default defineEventHandler(async (event) => {
  await requireMarketing(event)
  await ensureDb()
  const journey = (await loadJourneys(getRouterParam(event, 'id') ?? ''))[0]
  if (!journey)
    throw createError({ statusCode: 404, statusMessage: 'Journey not found' })
  return { journey: journeyResponse(journey) }
})
