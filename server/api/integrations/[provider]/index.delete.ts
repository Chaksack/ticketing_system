export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  await ensureDb()

  const providerId = getRouterParam(event, 'provider')
  const provider = getProviderConfig(providerId)
  if (!provider) {
    throw createError({ statusCode: 404, statusMessage: 'Unknown integration' })
  }

  await deleteStaffIntegration(user.id, provider.id)
  return { status: await getStaffIntegrationStatus(user.id, provider.id) }
})
