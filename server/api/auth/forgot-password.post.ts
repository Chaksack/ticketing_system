import type { StaffRow } from '../../utils/mappers'
import { randomBytes } from 'node:crypto'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: string }>(event)

  if (!body?.email) {
    throw createError({ statusCode: 400, statusMessage: 'Email is required' })
  }

  await ensureDb()
  const db = useDatabase()

  const row = await db.prepare('SELECT * FROM staff WHERE email = ?').get(body.email) as StaffRow | undefined

  // Always respond the same way whether or not the email exists, so this
  // endpoint can't be used to enumerate valid staff accounts.
  if (row && row.status !== 'disabled') {
    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()

    await db.prepare('UPDATE staff SET reset_token = ?, reset_expires_at = ? WHERE id = ?').run(token, expiresAt, row.id)

    try {
      await sendPasswordResetEmail({ to: row.email, name: row.name, token })
    }
    catch (error) {
      console.error('Failed to send password reset email', error)
    }
  }

  return { success: true }
})
