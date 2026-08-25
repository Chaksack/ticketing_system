export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const body = await readBody<{ message?: string }>(event)

  await ensureDb()
  const sections = await runAssistantQuery(user, body?.message ?? '')

  return { sections }
})
