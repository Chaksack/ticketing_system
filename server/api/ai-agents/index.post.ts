/** New AI agent (switched off until you're happy with it in the playground). */
export default defineEventHandler(async (event) => {
  const user = await requireAdmin(event)
  const { name } = await readBody<{ name?: string }>(event) ?? {}
  if (!name?.trim())
    throw createError({ statusCode: 400, statusMessage: 'Give the agent a name' })
  await ensureDb()
  const id = await nextPrefixedId('ai_agent', 'AGENT', 3)
  const now = new Date().toISOString()
  // Business hours start in the workspace's time zone (Admin → Organisation).
  const defaults = defaultAgentConfig()
  const config = { ...defaults, hours: { ...defaults.hours, timeZone: await workspaceTimeZone() } }
  const count = await useTenantDb().prepare('SELECT COUNT(*) AS count FROM ai_agents').get() as { count: string | number }
  await useTenantDb().prepare('INSERT INTO ai_agents (id, name, enabled, config, sort_no, created_at, updated_at, updated_by) VALUES (?, ?, 0, ?, ?, ?, ?, ?)').run(id, name.trim().slice(0, 80), JSON.stringify(config), Number(count.count), now, now, user.name)
  setResponseStatus(event, 201)
  return { agent: await loadAiAgent(id) }
})
