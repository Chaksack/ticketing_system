export default defineEventHandler(async (event) => {
  await requireMarketing(event)
  await ensureDb()
  const segment = await loadSegment(getRouterParam(event, 'id') ?? '')
  if (!segment)
    throw createError({ statusCode: 404, statusMessage: 'Segment not found' })
  return { segment, preview: await previewSegment(segment.conditions) }
})
