import type { HqRole, StaffRole } from '../../../../app/types/staff'
import type { StaffRow } from '../../../utils/mappers'

/** Edits someone: name, email, active/disabled, HQ access, workspace roles and Care clients. */
export default defineEventHandler(async (event) => {
  const user = await requirePlatformStaff(event)
  const id = getRouterParam(event, 'id') ?? ''
  const body = await readBody<{ name?: string, email?: string, status?: 'active' | 'disabled', hqRole?: HqRole | 'none', roles?: StaffRole[], engagementIds?: string[] }>(event) ?? {}

  await ensureDb()
  const db = useTenantDb()
  const existing = await db.prepare('SELECT * FROM staff WHERE id = ?').get(id) as StaffRow | undefined
  if (!existing)
    throw createError({ statusCode: 404, statusMessage: 'Person not found' })

  const hqRole = body.hqRole === undefined ? staffHqRole(existing) : cleanHqRole(body.hqRole)
  const roles = body.roles === undefined ? parseStaffRoles(existing) : cleanStaffRoles(body.roles)
  if (!roles.length && !hqRole)
    throw createError({ statusCode: 400, statusMessage: 'Give them HQ access or at least one workspace role' })

  // Re-enabling someone who never accepted their invite puts them back to pending.
  const disabling = body.status === 'disabled' && existing.status !== 'disabled'
  const status = body.status === 'disabled' ? 'disabled' : body.status === 'active' && existing.status === 'disabled' ? (existing.password_hash ? 'active' : 'pending') : existing.status

  // Someone has to be able to get back in here.
  if (id === user.id && (hqRole !== 'admin' || disabling))
    throw createError({ statusCode: 400, statusMessage: disabling ? 'You can\'t disable yourself' : 'You can\'t remove your own HQ admin access' })
  if (hqRole !== 'admin' || disabling)
    await assertKeepsHqAdmin(id)

  if (body.name !== undefined || body.email !== undefined)
    await updateStaffDetails(id, { name: body.name, email: body.email })

  await db.prepare('UPDATE staff SET hq_role = ?, role = ?, roles = ?, status = ? WHERE id = ?').run(hqRole ?? null, roles[0] ?? 'none', JSON.stringify(roles), status, id)

  await ensureCareTables()
  if (hqRole !== 'agent' && hqRole !== 'admin')
    await setAgentEngagements(id, [])
  else if (body.engagementIds)
    await setAgentEngagements(id, body.engagementIds)

  const row = await db.prepare('SELECT * FROM staff WHERE id = ?').get(id) as StaffRow
  return { staff: mapStaffRow(row) }
})
