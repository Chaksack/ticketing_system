interface UpdateTimesheetBody {
  workDate?: string
  hours?: number
  billable?: boolean
  notes?: string | null
}

interface TimesheetOwnerRow {
  id: string
  staff_id: string
  work_date: string
  hours: number | string
  billable: number
  notes: string | null
}

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)

  const id = getRouterParam(event, 'id')
  const body = await readBody<UpdateTimesheetBody>(event)

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing timesheet id' })
  }

  await ensureDb()
  const db = useDatabase()

  const existing = await db.prepare('SELECT * FROM timesheets WHERE id = ?').get(id) as TimesheetOwnerRow | undefined
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Timesheet entry not found' })
  }

  if (existing.staff_id !== user.id && !user.roles.includes('admin')) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  if (body.hours !== undefined && body.hours <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'hours must be positive' })
  }

  const workDate = body.workDate ?? existing.work_date
  const hours = body.hours ?? Number(existing.hours)
  const billable = body.billable === undefined ? existing.billable : (body.billable ? 1 : 0)
  const notes = body.notes !== undefined ? body.notes : existing.notes

  await db.prepare('UPDATE timesheets SET work_date = ?, hours = ?, billable = ?, notes = ?, updated_at = ? WHERE id = ?')
    .run(workDate, hours, billable, notes?.trim() || null, new Date().toISOString(), id)

  const entry = await getTimesheetById(id)
  return { entry }
})
