export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  await ensureDb()
  await useTenantDb().prepare('DELETE FROM support_shifts WHERE id = ?').run(getRouterParam(event, 'id') ?? '')
  return { shifts: await listSupportShifts() }
})
