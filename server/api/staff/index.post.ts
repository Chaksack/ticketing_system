import type { StaffRole } from '../../../app/types/staff'
import type { StaffRow } from '../../utils/mappers'
import { randomBytes } from 'node:crypto'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const body = await readBody<{ name?: string, email?: string, role?: StaffRole }>(event)

  if (!body?.name || !body?.email || !body?.role) {
    throw createError({ statusCode: 400, statusMessage: 'name, email and role are required' })
  }

  await ensureDb()
  const db = useDatabase()

  const existing = await db.prepare('SELECT id FROM staff WHERE email = ?').get(body.email)
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'A staff member with this email already exists' })
  }

  const id = await nextStaffId()
  const now = new Date().toISOString()
  const inviteToken = randomBytes(32).toString('hex')
  const inviteExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

  await db.prepare(`
    INSERT INTO staff (id, name, email, role, status, on_call, password_hash, invite_token, invite_expires_at, created_at)
    VALUES (?, ?, ?, ?, 'pending', 0, NULL, ?, ?, ?)
  `).run(id, body.name, body.email, body.role, inviteToken, inviteExpiresAt, now)

  let emailSent = true
  try {
    await sendStaffInviteEmail({ to: body.email, name: body.name, token: inviteToken })
  }
  catch (error) {
    console.error('Failed to send staff invite email', error)
    emailSent = false
  }

  const row = await db.prepare('SELECT * FROM staff WHERE id = ?').get(id) as StaffRow

  setResponseStatus(event, 201)
  return { staff: mapStaffRow(row), emailSent }
})
