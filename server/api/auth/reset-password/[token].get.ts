import type { StaffRow } from '../../../utils/mappers'

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  if (!token) {
    throw createError({ statusCode: 400, statusMessage: 'Missing reset token' })
  }

  await ensureDb()
  const db = useDatabase()

  const row = await db.prepare('SELECT * FROM staff WHERE reset_token = ?').get(token) as StaffRow | undefined

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'This reset link is invalid' })
  }

  if (!row.reset_expires_at || new Date(row.reset_expires_at).getTime() < Date.now()) {
    throw createError({ statusCode: 410, statusMessage: 'This reset link has expired' })
  }

  return { name: row.name, email: row.email }
})
