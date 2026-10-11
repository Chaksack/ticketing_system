// Every company on Canopy, with live staff and open-ticket counts from each one's database.
export default defineEventHandler(async (event) => {
  await requirePlatformStaff(event)

  const orgs = await listOrganizations()
  const tenants = []
  for (const org of orgs)
    tenants.push({ ...org, ...(await tenantStats(org)) })
  return { tenants }
})
