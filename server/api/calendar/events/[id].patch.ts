import type { RegardingType } from '../../../../app/types/interaction'
import type { CalendarEventRow } from '../../../utils/calendar'

interface UpdateEventBody {
  title?: string
  description?: string | null
  location?: string | null
  activityType?: string | null
  startAt?: string
  endAt?: string
  attendeeIds?: string[]
  regardingType?: RegardingType | null
  regardingId?: string | null
}

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)

  const id = getRouterParam(event, 'id')
  const body = await readBody<UpdateEventBody>(event)

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing event id' })
  }

  await ensureDb()
  const db = useDatabase()

  const existing = await db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(id) as CalendarEventRow | undefined
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Event not found' })
  }

  const title = body.title?.trim() || existing.title
  const description = body.description !== undefined ? body.description : existing.description
  const location = body.location !== undefined ? body.location : existing.location
  const activityType = body.activityType !== undefined ? (body.activityType?.trim() || null) : existing.activity_type
  const startAt = body.startAt ?? existing.start_at
  const endAt = body.endAt ?? existing.end_at

  if (new Date(endAt).getTime() <= new Date(startAt).getTime()) {
    throw createError({ statusCode: 400, statusMessage: 'endAt must be after startAt' })
  }

  const reminderSent = body.startAt && body.startAt !== existing.start_at ? 0 : existing.reminder_sent
  const regardingType = body.regardingType !== undefined ? body.regardingType : (existing.regarding_type as RegardingType | null)
  const regardingId = body.regardingId !== undefined ? body.regardingId : existing.regarding_id

  await db.prepare(`
    UPDATE calendar_events
    SET title = ?, description = ?, location = ?, activity_type = ?, start_at = ?, end_at = ?, regarding_type = ?, regarding_id = ?, reminder_sent = ?, updated_at = ?
    WHERE id = ?
  `).run(title, description, location, activityType, startAt, endAt, regardingType, regardingId, reminderSent, new Date().toISOString(), id)

  if (body.attendeeIds)
    await setEventAttendees(id, body.attendeeIds)

  const calendarEvent = await loadFullEvent(id)

  if (calendarEvent?.regardingType && calendarEvent.regardingId) {
    await upsertMeetingInteraction(calendarEvent, user.id)
  }
  else {
    await removeMeetingInteraction(id)
  }

  return { event: calendarEvent }
})
