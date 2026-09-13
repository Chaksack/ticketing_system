interface TimesheetOwnerRow {
  id: string
  staff_id: string
}

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing timesheet id' })
  }

  await ensureDb()
  const db = useDatabase()

  const existing = await db.prepare('SELECT id, staff_id FROM timesheets WHERE id = ?').get(id) as TimesheetOwnerRow | undefined
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Timesheet entry not found' })
  }

  if (existing.staff_id !== user.id && !user.roles.includes('admin')) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  await db.prepare('DELETE FROM timesheets WHERE id = ?').run(id)

  return { success: true }
})
