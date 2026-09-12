import type { RegardingType } from '../../../../app/types/interaction'

interface NewEventBody {
  title?: string
  description?: string
  location?: string
  activityType?: string
  startAt?: string
  endAt?: string
  attendeeIds?: string[]
  regardingType?: RegardingType
  regardingId?: string
}

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const body = await readBody<NewEventBody>(event)

  if (!body?.title?.trim() || !body?.startAt || !body?.endAt) {
    throw createError({ statusCode: 400, statusMessage: 'title, startAt and endAt are required' })
  }

  if (new Date(body.endAt).getTime() <= new Date(body.startAt).getTime()) {
    throw createError({ statusCode: 400, statusMessage: 'endAt must be after startAt' })
  }

  await ensureDb()
  const db = useDatabase()

  const id = await nextEventId()
  const now = new Date().toISOString()
  const regardingType = body.regardingType ?? null
  const regardingId = body.regardingId?.trim() || null
  const activityType = body.activityType?.trim() || null

  await db.prepare(`
    INSERT INTO calendar_events (id, title, description, location, activity_type, start_at, end_at, created_by, regarding_type, regarding_id, reminder_sent, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
  `).run(id, body.title.trim(), body.description ?? null, body.location ?? null, activityType, body.startAt, body.endAt, user.id, regardingType, regardingId, now, now)

  const attendeeIds = new Set([user.id, ...(body.attendeeIds ?? [])])
  await setEventAttendees(id, [...attendeeIds])

  const calendarEvent = await loadFullEvent(id)
  if (calendarEvent)
    await upsertMeetingInteraction(calendarEvent, user.id)

  return { event: calendarEvent }
})
