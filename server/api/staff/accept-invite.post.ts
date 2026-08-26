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
    avatarUrl: row.avatar_url ?? undefined,
  }

  const session = await useAuthSession(event)
  await session.update({ user })

  return { user }
})
