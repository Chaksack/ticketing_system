import type { SessionUser } from '../../utils/auth'
import type { StaffRow } from '../../utils/mappers'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: string, password?: string }>(event)

  if (!body?.email || !body?.password) {
    throw createError({ statusCode: 400, statusMessage: 'Email and password are required' })
  }

  // Each email belongs to one company (cp_directory); emails from before multi-company support
  // are the home workspace's.
  const orgId = (await lookupOrgIdByEmail(body.email)) ?? HOME_ORG_ID
  const org = await getOrganization(orgId)
  if (!org || org.status === 'provisioning')
    throw createError({ statusCode: 401, statusMessage: 'Invalid email or password' })
  if (org.status === 'suspended')
    throw createError({ statusCode: 403, statusMessage: 'This workspace is suspended. Contact Canopy support.' })
  setRequestOrg(event, orgId)

  await ensureDb()
  const db = useTenantDb()

  const row = await db.prepare('SELECT * FROM staff WHERE LOWER(email) = LOWER(?)').get(body.email) as StaffRow | undefined

  if (!row || !row.password_hash || !verifyPassword(body.password, row.password_hash)) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid email or password' })
  }

  if (row.status === 'disabled') {
    throw createError({ statusCode: 403, statusMessage: 'This account has been disabled' })
  }

  const user: SessionUser = {
    id: row.id,
    name: row.name,
    email: row.email,
    roles: parseStaffRoles(row),
    avatarUrl: row.avatar_url ?? undefined,
  }

  await startUserSession(event, user)

  return { user: { ...user, org: await sessionOrgSummary() } }
})
