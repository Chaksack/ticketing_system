import type { RegardingType } from '../../../../app/types/interaction'
import type { CalendarEventRow } from '../../../utils/calendar'

const REGARDING_TYPES: RegardingType[] = ['lead', 'tender', 'client']

export default defineEventHandler(async (event) => {
  await requireSessionUser(event)
  await ensureDb()

  const query = getQuery(event)
  const regardingType = query.regardingType
  const regardingId = query.regardingId

  if (typeof regardingType !== 'string' || !REGARDING_TYPES.includes(regardingType as RegardingType)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid regardingType' })
  }
  if (typeof regardingId !== 'string' || !regardingId) {
    throw createError({ statusCode: 400, statusMessage: 'regardingId is required' })
  }

  const db = useDatabase()

  const rows = await db.prepare(`
    SELECT calendar_events.*, staff.name AS created_by_name
    FROM calendar_events
    LEFT JOIN staff ON staff.id = calendar_events.created_by
    WHERE calendar_events.regarding_type = ? AND calendar_events.regarding_id = ?
    ORDER BY calendar_events.start_at DESC
  `).all(regardingType, regardingId) as CalendarEventRow[]

  const events = []
  for (const row of rows) {
    const attendees = await getEventAttendees(row.id)
    events.push(mapCalendarEventRow(row, attendees, undefined))
  }

  return { events }
})
