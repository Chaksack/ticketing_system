import type { SessionUser } from '../../utils/auth'
import type { StaffRow } from '../../utils/mappers'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: string, password?: string }>(event)

  if (!body?.email || !body?.password) {
    throw createError({ statusCode: 400, statusMessage: 'Email and password are required' })
  }

  await ensureDb()
  const db = useDatabase()

  const row = await db.prepare('SELECT * FROM staff WHERE email = ?').get(body.email) as StaffRow | undefined

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
    role: row.role as 'admin' | 'agent',
  }

  const session = await useAuthSession(event)
  await session.update({ user })

  return { user }
})
