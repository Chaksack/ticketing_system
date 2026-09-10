import type { CalendarEvent } from '../../app/types/calendar-event'
import type { Interaction, InteractionDirection, InteractionType, RegardingType } from '../../app/types/interaction'
import type { InteractionRow } from './mappers'

const INTERACTIONS_SELECT = `
  SELECT interactions.*, staff.name AS logged_by_name
  FROM interactions
  LEFT JOIN staff ON staff.id = interactions.logged_by
`

export async function getInteractions(regardingType: RegardingType, regardingId: string): Promise<Interaction[]> {
  const db = useDatabase()
  const rows = await db.prepare(`
    ${INTERACTIONS_SELECT}
    WHERE interactions.regarding_type = ? AND interactions.regarding_id = ?
    ORDER BY interactions.occurred_at DESC
  `).all(regardingType, regardingId) as InteractionRow[]

  return rows.map(row => mapInteractionRow(row))
}

export async function logInteraction(options: {
  regardingType: RegardingType
  regardingId: string
  type: InteractionType
  subject?: string
  body?: string
  direction?: InteractionDirection
  gmailMessageId?: string
  gmailThreadId?: string
  calendarEventId?: string
  occurredAt?: string
  loggedBy?: string
}): Promise<string> {
  const db = useDatabase()
  const id = await nextInteractionId()
  const now = new Date().toISOString()

  await db.prepare(`
    INSERT INTO interactions (id, regarding_type, regarding_id, type, subject, body, direction, gmail_message_id, gmail_thread_id, calendar_event_id, occurred_at, logged_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    options.regardingType,
    options.regardingId,
    options.type,
    options.subject ?? null,
    options.body ?? null,
    options.direction ?? null,
    options.gmailMessageId ?? null,
    options.gmailThreadId ?? null,
    options.calendarEventId ?? null,
    options.occurredAt ?? now,
    options.loggedBy ?? null,
    now,
  )

  return id
}

export async function deleteInteraction(id: string) {
  const db = useDatabase()
  await db.prepare('DELETE FROM interactions WHERE id = ?').run(id)
}

export async function upsertMeetingInteraction(event: CalendarEvent, loggedBy?: string) {
  if (!event.regardingType || !event.regardingId) {
    return
  }

  const db = useDatabase()
  await db.prepare('DELETE FROM interactions WHERE calendar_event_id = ?').run(event.id)
  await logInteraction({
    regardingType: event.regardingType,
    regardingId: event.regardingId,
    type: 'meeting',
    subject: event.title,
    body: event.description,
    calendarEventId: event.id,
    occurredAt: event.startAt,
    loggedBy,
  })
}

export async function removeMeetingInteraction(eventId: string) {
  const db = useDatabase()
  await db.prepare('DELETE FROM interactions WHERE calendar_event_id = ?').run(eventId)
}
