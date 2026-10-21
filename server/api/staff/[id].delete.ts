export default defineEventHandler(async (event) => {
  const user = await requireAdmin(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing staff id' })
  }

  await ensureDb()
  await removeStaffMember(id, user.id)

  return { success: true }
})
