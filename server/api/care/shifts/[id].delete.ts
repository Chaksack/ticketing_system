export default defineEventHandler(async (event) => {
  await requirePlatformStaff(event)
  await ensureCareTables()
  await useControlDb().prepare('DELETE FROM cp_care_shifts WHERE id = ?').run(getRouterParam(event, 'id') ?? '')
  return { ok: true }
})
