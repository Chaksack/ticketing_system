interface NewEventBody {
  title?: string
  description?: string
  location?: string
  startAt?: string
  endAt?: string
  attendeeIds?: string[]
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

  await db.prepare(`
    INSERT INTO calendar_events (id, title, description, location, start_at, end_at, created_by, reminder_sent, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
  `).run(id, body.title.trim(), body.description ?? null, body.location ?? null, body.startAt, body.endAt, user.id, now, now)

  const attendeeIds = new Set([user.id, ...(body.attendeeIds ?? [])])
  await setEventAttendees(id, [...attendeeIds])

  const calendarEvent = await loadFullEvent(id)
  return { event: calendarEvent }
})
