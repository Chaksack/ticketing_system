export default defineEventHandler(async (event) => {
  await requirePlatformStaff(event)

  const id = getRouterParam(event, 'id')!
  const org = await getOrganization(id, { fresh: true })
  if (!org)
    throw createError({ statusCode: 404, statusMessage: 'Tenant not found' })

  const onboarding = (await listOnboardings()).find(o => o.orgId === org.id) ?? null
  return { tenant: { ...org, ...(await tenantStats(org)) }, onboarding, audit: await listAudit(org.id, 50) }
})
