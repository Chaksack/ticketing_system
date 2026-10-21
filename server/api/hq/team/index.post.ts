import type { HqRole, StaffRole } from '../../../../app/types/staff'

/** Adds someone to Canopy: HQ admin, Care agent, or workspace only — with any workspace roles. */
export default defineEventHandler(async (event) => {
  await requirePlatformStaff(event)
  const body = await readBody<{ name?: string, email?: string, hqRole?: HqRole | 'none', roles?: StaffRole[], engagementIds?: string[] }>(event) ?? {}

  if (!body.name?.trim() || !body.email?.trim())
    throw createError({ statusCode: 400, statusMessage: 'Name and email are required' })
  const hqRole = cleanHqRole(body.hqRole)

  const result = await inviteStaffMember({ name: body.name, email: body.email, roles: cleanStaffRoles(body.roles), hqRole })
  if (hqRole === 'agent' && body.engagementIds?.length) {
    await ensureCareTables()
    await setAgentEngagements(result.staff.id, body.engagementIds)
  }

  setResponseStatus(event, 201)
  return result
})
