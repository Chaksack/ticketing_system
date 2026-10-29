import { randomUUID } from 'node:crypto'

/** Adds a shift for someone on one or more weekdays. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  await ensureDb()
  const body = await readBody<{ staffId?: string, weekdays?: number[], startTime?: string, endTime?: string }>(event) ?? {}
  const time = /^(?:[01]\d|2[0-3]):[0-5]\d$/
  if (!body.staffId || !time.test(body.startTime ?? '') || !time.test(body.endTime ?? ''))
    throw createError({ statusCode: 400, statusMessage: 'Pick a person and a start and end time' })
  if (body.startTime! >= body.endTime!)
    throw createError({ statusCode: 400, statusMessage: 'The shift must end after it starts' })
  const weekdays = [...new Set((body.weekdays ?? []).map(Number).filter(d => d >= 0 && d <= 6))]
  if (!weekdays.length)
    throw createError({ statusCode: 400, statusMessage: 'Pick at least one day' })
  const db = useTenantDb()
  if (!(await db.prepare('SELECT id FROM staff WHERE id = ?').get(body.staffId)))
    throw createError({ statusCode: 400, statusMessage: 'That person isn\'t on this workspace' })
  const now = new Date().toISOString()
  for (const weekday of weekdays)
    await db.prepare('INSERT INTO support_shifts (id, staff_id, weekday, start_time, end_time, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(`SHIFT-${randomUUID().slice(0, 10)}`, body.staffId, weekday, body.startTime, body.endTime, now)
  setResponseStatus(event, 201)
  return { shifts: await listSupportShifts() }
})
