import type { HqRole, StaffRole } from '../../../../app/types/staff'
import type { StaffRow } from '../../../utils/mappers'

/** Changes someone's HQ access, workspace roles and Care clients. */
export default defineEventHandler(async (event) => {
  const user = await requirePlatformStaff(event)
  const id = getRouterParam(event, 'id') ?? ''
  const body = await readBody<{ hqRole?: HqRole | 'none', roles?: StaffRole[], engagementIds?: string[] }>(event) ?? {}

  await ensureDb()
  const db = useTenantDb()
  const existing = await db.prepare('SELECT * FROM staff WHERE id = ?').get(id) as StaffRow | undefined
  if (!existing)
    throw createError({ statusCode: 404, statusMessage: 'Person not found' })

  const hqRole = body.hqRole === undefined ? staffHqRole(existing) : cleanHqRole(body.hqRole)
  const roles = body.roles === undefined ? parseStaffRoles(existing) : cleanStaffRoles(body.roles)
  if (!roles.length && !hqRole)
    throw createError({ statusCode: 400, statusMessage: 'Give them HQ access or at least one workspace role' })

  // Someone has to be able to get back in here.
  if (staffHqRole(existing) === 'admin' && hqRole !== 'admin') {
    if (id === user.id)
      throw createError({ statusCode: 400, statusMessage: 'You can\'t remove your own HQ admin access' })
    const admins = await db.prepare(`SELECT COUNT(*) AS count FROM staff WHERE hq_role = 'admin' AND status <> 'disabled'`).get() as { count: string | number }
    if (Number(admins.count) <= 1)
      throw createError({ statusCode: 400, statusMessage: 'Canopy HQ needs at least one HQ admin' })
  }

  await db.prepare('UPDATE staff SET hq_role = ?, role = ?, roles = ? WHERE id = ?').run(hqRole ?? null, roles[0] ?? 'none', JSON.stringify(roles), id)

  await ensureCareTables()
  if (hqRole !== 'agent' && hqRole !== 'admin')
    await setAgentEngagements(id, [])
  else if (body.engagementIds)
    await setAgentEngagements(id, body.engagementIds)

  const row = await db.prepare('SELECT * FROM staff WHERE id = ?').get(id) as StaffRow
  return { staff: mapStaffRow(row) }
})
