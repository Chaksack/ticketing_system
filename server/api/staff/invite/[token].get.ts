import type { StaffRow } from '../../../utils/mappers'

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  if (!token) {
    throw createError({ statusCode: 400, statusMessage: 'Missing invite token' })
  }

  await ensureDb()
  const db = useDatabase()

  const row = await db.prepare('SELECT * FROM staff WHERE invite_token = ?').get(token) as StaffRow | undefined

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'This invite link is invalid' })
  }

  if (!row.invite_expires_at || new Date(row.invite_expires_at).getTime() < Date.now()) {
    throw createError({ statusCode: 410, statusMessage: 'This invite link has expired' })
  }

  return { name: row.name, email: row.email }
})
