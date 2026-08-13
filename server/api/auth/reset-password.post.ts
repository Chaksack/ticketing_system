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

  const passwordHash = hashPassword(body.password)

  await db.prepare(`
    UPDATE staff
    SET password_hash = ?, reset_token = NULL, reset_expires_at = NULL
    WHERE id = ?
  `).run(passwordHash, row.id)

  const user: SessionUser = {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as 'admin' | 'agent',
  }

  const session = await useAuthSession(event)
  await session.update({ user })

  return { user }
})
