export default defineEventHandler(async (event) => {
  await requireSessionUser(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing event id' })
  }

  await ensureDb()
  const db = useDatabase()

  await db.prepare('DELETE FROM calendar_event_attendees WHERE event_id = ?').run(id)
  await db.prepare('DELETE FROM calendar_events WHERE id = ?').run(id)

  return { success: true }
})
