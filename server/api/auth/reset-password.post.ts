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

  await ensureDb()
  const db = useDatabase()

  const row = await db.prepare('SELECT * FROM staff WHERE reset_token = ?').get(body.token) as StaffRow | undefined

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'This reset link is invalid' })
  }

  if (!row.reset_expires_at || new Date(row.reset_expires_at).getTime() < Date.now()) {
    throw createError({ statusCode: 410, statusMessage: 'This reset link has expired' })
  }

  // Also signs out every other session for this person (e.g. if the account was compromised).
  const changedAt = await setStaffPassword(row.id, body.password)

  const user: SessionUser = {
    id: row.id,
    name: row.name,
    email: row.email,
    roles: parseStaffRoles(row),
    avatarUrl: row.avatar_url ?? undefined,
  }

  await startUserSession(event, user, changedAt)

  return { user }
})
