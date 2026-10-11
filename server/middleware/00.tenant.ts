/**
 * Points every API request at the right company database (server/utils/tenancy.ts): the
 * signed-in person's company, or the home workspace for signed-out requests. Public endpoints
 * that serve a specific company (portal tickets, API-key export, invite/reset links, sign-in)
 * switch it themselves with setRequestOrg once they know which one.
 */
export default defineEventHandler(async (event) => {
  if (!event.path.startsWith('/api/'))
    return

  await ensureControlDb()

  const session = await useAuthSession(event)
  const orgId = session.data.user ? (session.data.orgId ?? HOME_ORG_ID) : HOME_ORG_ID
  setRequestOrg(event, orgId)

  if (orgId !== HOME_ORG_ID) {
    const org = await getOrganization(orgId)
    if (!org || org.status === 'suspended') {
      // Signed-out routes must still work (e.g. signing in to another account).
      if (event.path.startsWith('/api/auth/login') || event.path.startsWith('/api/auth/logout'))
        return
      throw createError({ statusCode: 403, statusMessage: 'This workspace is suspended. Contact Canopy support.' })
    }
  }
})
