import type { CalendarEvent } from '../../app/types/calendar-event'
import type { RegardingType } from '../../app/types/interaction'
import type { AssigneeRef } from './assignees'

export interface CalendarEventRow {
  id: string
  title: string
  description: string | null
  location: string | null
  activity_type: string | null
  start_at: string
  end_at: string
  created_by: string | null
  created_by_name?: string | null
  regarding_type: string | null
  regarding_id: string | null
  reminder_sent: number
  created_at: string
  updated_at: string
}

export function mapCalendarEventRow(row: CalendarEventRow, attendees: AssigneeRef[] = [], regardingLabel?: string): CalendarEvent {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    location: row.location ?? undefined,
    activityType: row.activity_type ?? undefined,
    startAt: row.start_at,
    endAt: row.end_at,
    attendees,
    regardingType: (row.regarding_type as RegardingType) ?? undefined,
    regardingId: row.regarding_id ?? undefined,
    regardingLabel,
    createdBy: row.created_by ?? undefined,
    createdByName: row.created_by_name ?? undefined,
    reminderSent: !!row.reminder_sent,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function resolveRegardingLabel(regardingType: RegardingType | null | undefined, regardingId: string | null | undefined): Promise<string | undefined> {
  if (!regardingType || !regardingId)
    return undefined

  const db = useDatabase()
  const tables: Record<RegardingType, { table: string, nameColumn: string }> = {
    lead: { table: 'leads', nameColumn: 'name' },
    tender: { table: 'tenders', nameColumn: 'title' },
    client: { table: 'clients', nameColumn: 'name' },
  }
  const { table, nameColumn } = tables[regardingType]
  const row = await db.prepare(`SELECT ${nameColumn} AS label FROM ${table} WHERE id = ?`).get(regardingId) as { label: string } | undefined
  return row?.label
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
  const regardingLabel = await resolveRegardingLabel(row.regarding_type as RegardingType | null, row.regarding_id)
  return mapCalendarEventRow(row, attendees, regardingLabel)
}
