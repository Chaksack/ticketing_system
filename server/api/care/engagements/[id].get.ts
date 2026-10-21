export default defineEventHandler(async (event) => {
  await requirePlatformStaff(event)
  const engagement = await loadEngagement(getRouterParam(event, 'id') ?? '')
  if (!engagement)
    throw createError({ statusCode: 404, statusMessage: 'Engagement not found' })
  // Canopy staff with HQ access (Canopy HQ → Team & access) can be assigned as Care agents.
  const staff = await useTenantDb().prepare(`SELECT id, name FROM staff WHERE status <> 'disabled' AND hq_role IN ('admin', 'agent') ORDER BY name`).all() as { id: string, name: string }[]
  return { engagement, staff }
})
