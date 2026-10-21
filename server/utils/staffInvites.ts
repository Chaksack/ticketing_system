import type { HqRole, StaffRole } from '../../app/types/staff'
import type { StaffRow } from './mappers'

/**
 * Creates a pending staff member in the current company and emails them an invite link
 * (org-scoped token, so the link opens the right workspace). Shared by Admin → Staff and the
 * self-serve sign-up's "Invite your team" step.
 */
export async function inviteStaffMember(input: { name: string, email: string, roles: StaffRole[], hqRole?: HqRole, invitedByOrgName?: string }) {
  // HQ-only people (e.g. Care agents) may have no workspace roles; everyone else needs one.
  const hqRole = currentOrgId() === HOME_ORG_ID ? input.hqRole : undefined
  if (!input.roles.length && !hqRole)
    throw createError({ statusCode: 400, statusMessage: 'Pick at least one role' })
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
      INSERT INTO staff (id, name, email, role, roles, hq_role, status, on_call, password_hash, invite_token, invite_expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, NULL, ?, ?, ?)
    `).run(id, input.name.trim(), email, input.roles[0] ?? 'none', JSON.stringify(input.roles), hqRole ?? null, inviteToken, inviteExpiresAt, now)
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

const STAFF_ROLES: StaffRole[] = ['admin', 'agent', 'bd', 'sm', 'finance', 'engineer', 'engineering_coordinator', 'engineering_lead']

/** Known workspace roles only, each once. */
export function cleanStaffRoles(roles: unknown): StaffRole[] {
  return Array.isArray(roles) ? [...new Set(roles.filter((role): role is StaffRole => STAFF_ROLES.includes(role)))] : []
}

/** 'admin' | 'agent', or undefined for "workspace only". */
export function cleanHqRole(value: unknown): HqRole | undefined {
  return value === 'admin' || value === 'agent' ? value : undefined
}

/** Refuses a change that would leave Canopy HQ without an active HQ admin (call before disabling, demoting or deleting `staffId`). */
export async function assertKeepsHqAdmin(staffId: string) {
  const db = useTenantDb()
  const row = await db.prepare('SELECT hq_role, status FROM staff WHERE id = ?').get(staffId) as { hq_role: string | null, status: string } | undefined
  if (!row || staffHqRole(row) !== 'admin' || row.status === 'disabled')
    return
  const others = await db.prepare(`SELECT COUNT(*) AS count FROM staff WHERE hq_role = 'admin' AND status <> 'disabled' AND id <> ?`).get(staffId) as { count: string | number }
  if (Number(others.count) === 0)
    throw createError({ statusCode: 400, statusMessage: 'Canopy HQ needs at least one HQ admin' })
}

/** Renames someone and/or changes their sign-in email (which moves their entry in the company directory). */
export async function updateStaffDetails(staffId: string, input: { name?: string, email?: string }) {
  const db = useTenantDb()
  const existing = await db.prepare('SELECT name, email FROM staff WHERE id = ?').get(staffId) as { name: string, email: string } | undefined
  if (!existing)
    throw createError({ statusCode: 404, statusMessage: 'Staff member not found' })

  const name = input.name === undefined ? existing.name : input.name.trim()
  if (name.length < 2)
    throw createError({ statusCode: 400, statusMessage: 'Name must be at least 2 characters' })

  const email = input.email === undefined ? existing.email : input.email.trim()
  const emailChanged = email.toLowerCase() !== existing.email.toLowerCase()
  if (emailChanged) {
    if (!/^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/.test(email))
      throw createError({ statusCode: 400, statusMessage: 'Enter a valid email address' })
    const taken = await db.prepare('SELECT id FROM staff WHERE LOWER(email) = LOWER(?) AND id <> ?').get(email, staffId)
    if (taken)
      throw createError({ statusCode: 409, statusMessage: `${email} is already on this workspace` })
    // Claims the new address first (409 if another company has it), then frees the old one.
    await registerDirectoryEmail(email, currentOrgId())
  }

  await db.prepare('UPDATE staff SET name = ?, email = ? WHERE id = ?').run(name, email, staffId)
  if (emailChanged)
    await unregisterDirectoryEmail(existing.email, currentOrgId())
}

/** Deletes someone from the current company: their sign-in, push subscriptions, Care assignments and directory entry. */
export async function removeStaffMember(staffId: string, actorId: string) {
  if (staffId === actorId)
    throw createError({ statusCode: 400, statusMessage: 'You can\'t delete yourself' })
  await assertKeepsHqAdmin(staffId)

  const db = useTenantDb()
  const row = await db.prepare('SELECT email FROM staff WHERE id = ?').get(staffId) as { email: string } | undefined
  if (!row)
    throw createError({ statusCode: 404, statusMessage: 'Staff member not found' })

  await db.prepare('DELETE FROM push_subscriptions WHERE staff_id = ?').run(staffId)
  await db.prepare('DELETE FROM staff WHERE id = ?').run(staffId)
  if (currentOrgId() === HOME_ORG_ID) {
    await ensureCareTables()
    await setAgentEngagements(staffId, [])
  }
  // Frees the email so the person could join (or be invited to) another workspace.
  await unregisterDirectoryEmail(row.email, currentOrgId())
}
