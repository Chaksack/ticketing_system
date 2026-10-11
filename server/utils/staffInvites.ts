import type { StaffRole } from '../../app/types/staff'
import type { StaffRow } from './mappers'

/**
 * Creates a pending staff member in the current company and emails them an invite link
 * (org-scoped token, so the link opens the right workspace). Shared by Admin → Staff and the
 * self-serve sign-up's "Invite your team" step.
 */
export async function inviteStaffMember(input: { name: string, email: string, roles: StaffRole[], invitedByOrgName?: string }) {
  await ensureDb()
  const db = useTenantDb()
  const email = input.email.trim()

  const existing = await db.prepare('SELECT id FROM staff WHERE LOWER(email) = LOWER(?)').get(email)
  if (existing)
    throw createError({ statusCode: 409, statusMessage: `${email} is already on this workspace` })
  // One company per person — claims the email for this workspace (409 if another has it).
  await registerDirectoryEmail(email, currentOrgId())

  const id = await nextStaffId()
  const now = new Date().toISOString()
  const inviteToken = newOrgToken()
  const inviteExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

  try {
    await db.prepare(`
      INSERT INTO staff (id, name, email, role, roles, status, on_call, password_hash, invite_token, invite_expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, 'pending', 0, NULL, ?, ?, ?)
    `).run(id, input.name.trim(), email, input.roles[0], JSON.stringify(input.roles), inviteToken, inviteExpiresAt, now)
  }
  catch (error) {
    await unregisterDirectoryEmail(email, currentOrgId())
    throw error
  }

  let emailSent = true
  try {
    await sendStaffInviteEmail({ to: email, name: input.name.trim(), token: inviteToken })
  }
  catch (error) {
    console.error('Failed to send staff invite email', error)
    emailSent = false
  }

  const row = await db.prepare('SELECT * FROM staff WHERE id = ?').get(id) as StaffRow
  return { staff: mapStaffRow(row), emailSent }
}
