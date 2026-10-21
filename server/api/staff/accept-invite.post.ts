import type { SessionUser } from '../../utils/auth'
import type { StaffRow } from '../../utils/mappers'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ token?: string, password?: string }>(event)

  if (!body?.token || !body?.password) {
    throw createError({ statusCode: 400, statusMessage: 'Token and password are required' })
  }

  if (body.password.length < 8) {
    throw createError({ statusCode: 400, statusMessage: 'Password must be at least 8 characters' })
  }

  // The token says which company it belongs to (newOrgToken) — open that company's database.
  await useOrgFromToken(event, body.token)

  await ensureDb()
  const db = useTenantDb()

  const row = await db.prepare('SELECT * FROM staff WHERE invite_token = ?').get(body.token) as StaffRow | undefined

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'This invite link is invalid' })
  }

  if (!row.invite_expires_at || new Date(row.invite_expires_at).getTime() < Date.now()) {
    throw createError({ statusCode: 410, statusMessage: 'This invite link has expired' })
  }

  const passwordHash = hashPassword(body.password)

  await db.prepare(`
    UPDATE staff
    SET password_hash = ?, status = 'active', invite_token = NULL, invite_expires_at = NULL
    WHERE id = ?
  `).run(passwordHash, row.id)

  const user: SessionUser = {
    id: row.id,
    name: row.name,
    email: row.email,
    roles: parseStaffRoles(row),
    hqRole: staffHqRole(row),
    avatarUrl: row.avatar_url ?? undefined,
  }

  await startUserSession(event, user)

  return { user: { ...user, org: await sessionOrgSummary() } }
})
