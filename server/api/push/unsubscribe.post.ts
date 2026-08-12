export default defineEventHandler(async (event) => {
  await requireSessionUser(event)
  const body = await readBody<{ endpoint?: string }>(event)

  if (!body?.endpoint) {
    throw createError({ statusCode: 400, statusMessage: 'endpoint is required' })
  }

  await ensureDb()
  const db = useDatabase()
  await db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(body.endpoint)

  return { success: true }
})
