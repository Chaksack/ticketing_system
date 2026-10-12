export default defineEventHandler(async (event) => {
  await requireMarketing(event)
  await ensureDb()
  const id = getRouterParam(event, 'id') ?? ''
  const db = useTenantDb()
  const used = await db.prepare('SELECT name FROM marketing_journeys WHERE segment_id = ? LIMIT 1').get(id) as { name: string } | undefined
  if (used)
    throw createError({ statusCode: 409, statusMessage: `The journey "${used.name}" uses this segment` })
  await db.prepare('DELETE FROM marketing_segments WHERE id = ?').run(id)
  return { ok: true }
})
