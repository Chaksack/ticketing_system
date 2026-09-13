export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  await ensureDb()

  const query = getQuery(event)
  const requestedStaffId = typeof query.staffId === 'string' && query.staffId ? query.staffId : undefined
  const projectId = typeof query.projectId === 'string' && query.projectId ? query.projectId : undefined
  const taskId = typeof query.taskId === 'string' && query.taskId ? query.taskId : undefined
  const from = typeof query.from === 'string' && query.from ? query.from : undefined
  const to = typeof query.to === 'string' && query.to ? query.to : undefined

  if (requestedStaffId && requestedStaffId !== user.id && !isCapacityViewer(user)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  // No staffId given: capacity-viewers get everyone's entries (for reporting), everyone else
  // defaults to just their own — same default-scope convention as clients.vue's viewScope.
  const staffId = requestedStaffId ?? (isCapacityViewer(user) ? undefined : user.id)

  const entries = await getTimesheets({ staffId, projectId, taskId, from, to })
  return { entries }
})
