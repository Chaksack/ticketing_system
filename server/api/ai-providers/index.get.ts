// The signed-in person's own AI connections for "Ask AI" (Settings → Integrations).
export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  await ensureDb()
  return { settings: await getAiSettings(user.id) }
})
