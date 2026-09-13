import type { StaffRow } from '../../utils/mappers'

interface NewTimesheetBody {
  taskId?: string
  workDate?: string
  hours?: number
  billable?: boolean
  notes?: string
}

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)

  const body = await readBody<NewTimesheetBody>(event)

  if (!body?.taskId?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'taskId is required' })
  }
  if (!body.workDate) {
    throw createError({ statusCode: 400, statusMessage: 'workDate is required' })
  }
  if (body.hours === undefined || body.hours <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'A positive number of hours is required' })
  }

  await ensureDb()
  const db = useDatabase()

  const task = await db.prepare('SELECT id FROM tasks WHERE id = ?').get(body.taskId.trim())
  if (!task) {
    throw createError({ statusCode: 400, statusMessage: `Unknown task: ${body.taskId}` })
  }

  const staffRow = await db.prepare('SELECT * FROM staff WHERE id = ?').get(user.id) as StaffRow
  const hourlyRate = staffRow.hourly_rate ? Number(staffRow.hourly_rate) : 0

  const id = await nextTimesheetId()
  const now = new Date().toISOString()

  await db.prepare(`
    INSERT INTO timesheets (id, staff_id, task_id, work_date, hours, hourly_rate, billable, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, user.id, body.taskId.trim(), body.workDate, body.hours, hourlyRate, body.billable === false ? 0 : 1, body.notes?.trim() || null, now, now)

  const entry = await getTimesheetById(id)

  setResponseStatus(event, 201)
  return { entry }
})
