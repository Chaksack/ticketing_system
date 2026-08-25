import type { StaffRow } from '../../utils/mappers'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)

  const body = await readBody<{ currentPassword?: string, newPassword?: string }>(event)

  if (!body?.currentPassword || !body?.newPassword) {
    throw createError({ statusCode: 400, statusMessage: 'currentPassword and newPassword are required' })
  }

  if (body.newPassword.length < 8) {
    throw createError({ statusCode: 400, statusMessage: 'New password must be at least 8 characters' })
  }

  await ensureDb()
  const db = useDatabase()

  const row = await db.prepare('SELECT * FROM staff WHERE id = ?').get(sessionUser.id) as StaffRow | undefined
  if (!row?.password_hash || !verifyPassword(body.currentPassword, row.password_hash)) {
    throw createError({ statusCode: 401, statusMessage: 'Current password is incorrect' })
  }

  const newHash = hashPassword(body.newPassword)
  await db.prepare('UPDATE staff SET password_hash = ? WHERE id = ?').run(newHash, sessionUser.id)

  return { success: true }
})
