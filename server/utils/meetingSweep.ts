import type { CalendarEventRow } from './calendar'

const REMINDER_LEAD_MINUTES = 15

export async function checkMeetingReminders() {
  await ensureDb()
  const db = useDatabase()

  const now = new Date()
  const threshold = new Date(now.getTime() + REMINDER_LEAD_MINUTES * 60 * 1000).toISOString()
  const nowIso = now.toISOString()

  const due = await db.prepare(`
    SELECT * FROM calendar_events
    WHERE reminder_sent = 0 AND start_at <= ? AND start_at > ?
  `).all(threshold, nowIso) as CalendarEventRow[]

  for (const calendarEvent of due) {
    const attendees = await getEventAttendees(calendarEvent.id)
    const title = `Meeting starting soon: ${calendarEvent.title}`
    const startTime = new Date(calendarEvent.start_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    const body = calendarEvent.location ? `Starts at ${startTime} — ${calendarEvent.location}` : `Starts at ${startTime}`
    const url = `/calendar?event=${calendarEvent.id}`

    for (const attendee of attendees) {
      await createNotification({ staffId: attendee.id, type: 'meeting_reminder', title, body, url, eventId: calendarEvent.id })
      await sendPushToStaff(attendee.id, { title, body, url })
    }

    await db.prepare('UPDATE calendar_events SET reminder_sent = 1 WHERE id = ?').run(calendarEvent.id)
  }

  return { reminded: due.length }
}
