/** Deletes the agent. Its chats keep their transcripts; anything it was handling goes to the team. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  await ensureDb()
  const agent = await loadAiAgent(getRouterParam(event, 'id') ?? '')
  if (!agent)
    throw createError({ statusCode: 404, statusMessage: 'AI agent not found' })
  const open = await useTenantDb().prepare('SELECT id FROM live_chats WHERE status = \'ai\' AND ai_agent_id = ?').all(agent.id) as { id: string }[]
  for (const chat of open)
    await handOffChat(chat.id, agent, 'the AI agent was deleted')
  await useTenantDb().prepare('DELETE FROM ai_agents WHERE id = ?').run(agent.id)
  return { ok: true }
})
