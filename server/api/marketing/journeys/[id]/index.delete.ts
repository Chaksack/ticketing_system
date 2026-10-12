export default defineEventHandler(async (event) => {
  await requireMarketing(event)
  await ensureDb()
  const id = getRouterParam(event, 'id') ?? ''
  const db = useTenantDb()
  await db.prepare('DELETE FROM journey_enrollments WHERE journey_id = ?').run(id)
  await db.prepare('DELETE FROM marketing_journeys WHERE id = ?').run(id)
  return { ok: true }
})
