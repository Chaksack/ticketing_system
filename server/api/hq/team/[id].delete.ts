/** Removes someone from Canopy entirely (HQ access, workspace roles and Care assignments). */
export default defineEventHandler(async (event) => {
  const user = await requirePlatformStaff(event)
  await ensureDb()
  await removeStaffMember(getRouterParam(event, 'id') ?? '', user.id)
  return { success: true }
})
