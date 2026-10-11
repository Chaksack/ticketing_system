import type { StaffRow } from '../../../utils/mappers'

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  if (!token) {
    throw createError({ statusCode: 400, statusMessage: 'Missing reset token' })
  }

  // The token says which company it belongs to (newOrgToken) — open that company's database.
  await useOrgFromToken(event, token)

  await ensureDb()
  const db = useTenantDb()

  const row = await db.prepare('SELECT * FROM staff WHERE reset_token = ?').get(token) as StaffRow | undefined

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'This reset link is invalid' })
  }

  if (!row.reset_expires_at || new Date(row.reset_expires_at).getTime() < Date.now()) {
    throw createError({ statusCode: 410, statusMessage: 'This reset link has expired' })
  }

  return { name: row.name, email: row.email }
})
