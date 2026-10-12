export default defineEventHandler(async (event) => {
  await requireMarketing(event)
  await ensureDb()
  return { journeys: (await loadJourneys()).map(j => journeyResponse(j)!) }
})
