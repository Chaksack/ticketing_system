import type { StaffRole } from '../../../app/types/staff'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const body = await readBody<{ name?: string, email?: string, roles?: StaffRole[] }>(event)

  if (!body?.name || !body?.email || !body?.roles?.length) {
    throw createError({ statusCode: 400, statusMessage: 'name, email and at least one role are required' })
  }

  const result = await inviteStaffMember({ name: body.name, email: body.email, roles: body.roles })

  setResponseStatus(event, 201)
  return result
})
