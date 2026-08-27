import type { CalendarEvent } from '../../app/types/calendar-event'
import type { AssigneeRef } from './assignees'

export interface CalendarEventRow {
  id: string
  title: string
  description: string | null
  location: string | null
  start_at: string
  end_at: string
  created_by: string | null
  created_by_name?: string | null
  reminder_sent: number
  created_at: string
  updated_at: string
}

export function mapCalendarEventRow(row: CalendarEventRow, attendees: AssigneeRef[] = []): CalendarEvent {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    location: row.location ?? undefined,
    startAt: row.start_at,
    endAt: row.end_at,
    attendees,
    createdBy: row.created_by ?? undefined,
    createdByName: row.created_by_name ?? undefined,
    reminderSent: !!row.reminder_sent,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function getEventAttendees(eventId: string): Promise<AssigneeRef[]> {
  const db = useDatabase()
  return await db.prepare(`
    SELECT staff.id, staff.name
    FROM calendar_event_attendees
    JOIN staff ON staff.id = calendar_event_attendees.staff_id
    WHERE calendar_event_attendees.event_id = ?
    ORDER BY staff.name ASC
  `).all(eventId) as AssigneeRef[]
}

export async function setEventAttendees(eventId: string, staffIds: string[]) {
  const db = useDatabase()
  await db.prepare('DELETE FROM calendar_event_attendees WHERE event_id = ?').run(eventId)
  for (const staffId of new Set(staffIds))
    await db.prepare('INSERT INTO calendar_event_attendees (event_id, staff_id) VALUES (?, ?)').run(eventId, staffId)
}

export async function loadFullEvent(eventId: string): Promise<CalendarEvent | null> {
  const db = useDatabase()
  const row = await db.prepare(`
    SELECT calendar_events.*, staff.name AS created_by_name
    FROM calendar_events
    LEFT JOIN staff ON staff.id = calendar_events.created_by
    WHERE calendar_events.id = ?
  `).get(eventId) as CalendarEventRow | undefined

  if (!row)
    return null

  const attendees = await getEventAttendees(eventId)
  return mapCalendarEventRow(row, attendees)
}
