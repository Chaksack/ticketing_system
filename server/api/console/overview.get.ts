// Staff console overview: tenants by status, onboardings in flight, recent sign-ups and staff actions.
export default defineEventHandler(async (event) => {
  await requirePlatformStaff(event)

  const orgs = (await listOrganizations()).filter(org => !org.isHome)
  const onboardings = await listOnboardings()
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  return {
    tenants: {
      total: orgs.length,
      active: orgs.filter(org => org.status === 'active').length,
      suspended: orgs.filter(org => org.status === 'suspended').length,
      newThisWeek: orgs.filter(org => org.createdAt >= weekAgo).length,
      selfServe: orgs.filter(org => org.source === 'self_serve').length,
      staffLed: orgs.filter(org => org.source === 'staff').length,
    },
    onboardings: {
      draft: onboardings.filter(o => o.status === 'draft').length,
      signed: onboardings.filter(o => o.status === 'signed').length,
      provisioned: onboardings.filter(o => o.status === 'provisioned').length,
    },
    recentTenants: orgs.slice(0, 6),
    recentAudit: await listAudit(undefined, 12),
  }
})
