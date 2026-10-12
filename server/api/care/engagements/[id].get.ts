export default defineEventHandler(async (event) => {
  await requirePlatformStaff(event)
  const engagement = await loadEngagement(getRouterParam(event, 'id') ?? '')
  if (!engagement)
    throw createError({ statusCode: 404, statusMessage: 'Engagement not found' })
  // Canopy staff who can be assigned as Care agents.
  const staff = await useTenantDb().prepare('SELECT id, name FROM staff WHERE status = \'active\' ORDER BY name').all() as { id: string, name: string }[]
  return { engagement, staff }
})
