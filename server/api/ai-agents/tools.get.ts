import type { AiAgentTool } from '../../../app/types/aiAgent'
import { AI_TOOL_OPTIONS } from '../../../app/types/aiAgent'

// The tool names the model calls, per tool switch in the agent settings.
const CALL_NAMES: Record<AiAgentTool, string> = {
  search_knowledge: 'search_knowledge_base',
  customer_tickets: 'list_customer_tickets',
  create_ticket: 'create_ticket',
  handoff: 'handoff_to_human',
}

/** The tools AI agents can use, which agents have them switched on, and how often they ran (30 days). */
export default defineEventHandler(async (event) => {
  await requireServiceStaff(event)
  await ensureDb()
  const agents = await listAiAgents()
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const rows = await useTenantDb().prepare('SELECT steps, outcome FROM ai_agent_runs WHERE dry_run = 0 AND created_at >= ?').all(since) as { steps: string, outcome: string }[]
  const calls = new Map<string, number>()
  for (const row of rows) {
    for (const step of JSON.parse(row.steps) as { tool: string }[])
      calls.set(step.tool, (calls.get(step.tool) ?? 0) + 1)
  }
  return {
    tools: AI_TOOL_OPTIONS.map(tool => ({
      ...tool,
      callName: CALL_NAMES[tool.value],
      agents: agents.filter(a => a.tools.includes(tool.value)).map(a => ({ id: a.id, name: a.name, enabled: a.enabled })),
      callsLast30Days: tool.value === 'handoff' ? rows.filter(r => r.outcome === 'handoff').length : (calls.get(CALL_NAMES[tool.value]) ?? 0),
    })),
  }
})
