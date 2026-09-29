import type { StaffRow } from '../../../utils/mappers'
import { randomBytes } from 'node:crypto'

// Longer than the self-serve "forgot password" link (1 hour) — the person may not see the
// admin's email straight away.
const ADMIN_RESET_LINK_HOURS = 24

/**
 * Admin-only: sends any staff member (other admins included) a single-use link to the existing
 * /reset-password/:token page, where they choose their own new password. Admins never set or see
 * anyone's password. Once the person sets a new one, their other sessions are signed out
 * (setStaffPassword / getSessionUser).
 */
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing staff id' })
  }

  await ensureDb()
  const db = useDatabase()

  const row = await db.prepare('SELECT * FROM staff WHERE id = ?').get(id) as StaffRow | undefined
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Staff member not found' })
  }
  if (row.status === 'pending') {
    throw createError({ statusCode: 400, statusMessage: `${row.name} hasn't accepted their invite yet. Resend the invite instead.` })
  }
  if (row.status === 'disabled') {
    throw createError({ statusCode: 400, statusMessage: `${row.name}'s account is disabled. Re-enable it before sending a reset link.` })
  }

  const isSelf = row.id === admin.id
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + ADMIN_RESET_LINK_HOURS * 60 * 60 * 1000).toISOString()
  await db.prepare('UPDATE staff SET reset_token = ?, reset_expires_at = ? WHERE id = ?').run(token, expiresAt, row.id)

  let emailSent = false
  try {
    await sendPasswordResetEmail({ to: row.email, name: row.name, token, requestedBy: isSelf ? undefined : admin.name, expiresIn: `${ADMIN_RESET_LINK_HOURS} hours` })
    emailSent = true
  }
  catch (error) {
    console.error(`[staff] Failed to email a reset link to ${row.id}`, error)
  }

  console.warn(`[staff][audit] ${admin.id} issued a password reset link for ${row.id} (emailed: ${emailSent})`)

  // The link is only returned when the email didn't go out, so the admin can pass it on another
  // way. It only lets the recipient choose a password — the admin still never learns it.
  return {
    emailSent,
    email: row.email,
    expiresAt,
    resetUrl: emailSent ? undefined : passwordResetLink(token),
  }
})
