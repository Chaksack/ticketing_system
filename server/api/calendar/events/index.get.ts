import type { CalendarEventRow } from '../../../utils/calendar'

export default defineEventHandler(async (event) => {
  await requireSessionUser(event)
  await ensureDb()

  const query = getQuery(event)
  const from = typeof query.from === 'string' && query.from ? query.from : null
  const to = typeof query.to === 'string' && query.to ? query.to : null

  const db = useDatabase()

  const rows = await db.prepare(`
    SELECT calendar_events.*, staff.name AS created_by_name
    FROM calendar_events
    LEFT JOIN staff ON staff.id = calendar_events.created_by
    ${from && to ? 'WHERE calendar_events.start_at <= ? AND calendar_events.end_at >= ?' : ''}
    ORDER BY calendar_events.start_at ASC
  `).all(...(from && to ? [to, from] : [])) as CalendarEventRow[]

  const events = []
  for (const row of rows) {
    const attendees = await getEventAttendees(row.id)
    events.push(mapCalendarEventRow(row, attendees))
  }

  return { events }
})
