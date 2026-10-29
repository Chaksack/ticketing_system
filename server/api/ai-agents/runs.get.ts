/** AI activity across all agents. Filters: agentId, outcome, tests=1 to include playground runs. */
export default defineEventHandler(async (event) => {
  await requireServiceStaff(event)
  await ensureDb()
  const query = getQuery(event)
  const where: string[] = []
  const args: string[] = []
  if (typeof query.agentId === 'string' && query.agentId) {
    where.push('ai_agent_runs.agent_id = ?')
    args.push(query.agentId)
  }
  if (typeof query.outcome === 'string' && query.outcome) {
    where.push('ai_agent_runs.outcome = ?')
    args.push(query.outcome)
  }
  if (query.tests !== '1')
    where.push('ai_agent_runs.dry_run = 0')
  const rows = await useTenantDb().prepare(`${RUN_SELECT}${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY ai_agent_runs.created_at DESC LIMIT 200`).all(...args) as Parameters<typeof mapRunRow>[0][]
  const runs = rows.map(mapRunRow)
  return {
    runs,
    totals: {
      runs: runs.length,
      inputTokens: runs.reduce((sum, r) => sum + r.inputTokens, 0),
      outputTokens: runs.reduce((sum, r) => sum + r.outputTokens, 0),
      avgLatencyMs: runs.length ? Math.round(runs.reduce((sum, r) => sum + r.latencyMs, 0) / runs.length) : 0,
    },
    agents: (await listAiAgents()).map(a => ({ id: a.id, name: a.name })),
  }
})
