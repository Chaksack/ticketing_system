export default defineEventHandler(async (event) => {
  await requireDispatcher(event)
  await ensureDb()
  await useTenantDb().prepare('DELETE FROM technician_unavailability WHERE id = ?').run(getRouterParam(event, 'id') ?? '')
  return { ok: true }
})
