import type { AiAgentRun } from '../../../../app/types/aiAgent'

/** One agent: settings, numbers, recent activity, and the questions it couldn't answer. */
export default defineEventHandler(async (event) => {
  await requireServiceStaff(event)
  await ensureDb()
  const agent = await loadAiAgent(getRouterParam(event, 'id') ?? '')
  if (!agent)
    throw createError({ statusCode: 404, statusMessage: 'AI agent not found' })

  const db = useTenantDb()
  const runs = (await db.prepare(`${RUN_SELECT} WHERE ai_agent_runs.agent_id = ? ORDER BY ai_agent_runs.created_at DESC LIMIT 60`).all(agent.id) as Parameters<typeof mapRunRow>[0][]).map(mapRunRow)
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const gaps = (await db.prepare(`
    ${RUN_SELECT} WHERE ai_agent_runs.agent_id = ? AND ai_agent_runs.dry_run = 0 AND ai_agent_runs.gap_article_id IS NULL AND ai_agent_runs.created_at >= ?
      AND (ai_agent_runs.outcome = 'fallback' OR ai_agent_runs.handoff_reason IN (?, ?))
    ORDER BY ai_agent_runs.created_at DESC LIMIT 50
  `).all(agent.id, since, ...GAP_REASONS) as Parameters<typeof mapRunRow>[0][]).map(mapRunRow)
  const products = await db.prepare('SELECT products FROM kb_articles WHERE status = \'published\' AND products IS NOT NULL').all() as { products: string }[]

  return {
    agent,
    stats: await agentStats(agent.id),
    runs: runs as AiAgentRun[],
    gaps: gaps as AiAgentRun[],
    products: [...new Set(products.flatMap(row => row.products.split(',').map(p => p.trim()).filter(Boolean)))].sort(),
    model: await getAiModelSettings(),
  }
})
