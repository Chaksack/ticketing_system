import type { AiAgent } from '../../../../app/types/aiAgent'

/** Save the agent's settings, or switch it on/off. */
export default defineEventHandler(async (event) => {
  const user = await requireAdmin(event)
  await ensureDb()
  const existing = await loadAiAgent(getRouterParam(event, 'id') ?? '')
  if (!existing)
    throw createError({ statusCode: 404, statusMessage: 'AI agent not found' })
  const body = await readBody<Partial<AiAgent>>(event) ?? {}

  const { name, ...config } = cleanAgentInput(body, existing)
  if (name !== undefined && !name)
    throw createError({ statusCode: 400, statusMessage: 'Give the agent a name' })
  const enabled = body.enabled === undefined ? existing.enabled : !!body.enabled
  if (enabled && !existing.enabled) {
    // Switching on without a working AI would just hand every chat off — say so up front.
    const model = await getAiModelSettings()
    if (model.provider === 'company' ? !model.companyKeyAvailable : !model.hasApiKey)
      throw createError({ statusCode: 400, statusMessage: 'Connect an AI model first (Model settings on the AI agents page).' })
  }

  await useTenantDb().prepare('UPDATE ai_agents SET name = ?, enabled = ?, config = ?, updated_at = ?, updated_by = ? WHERE id = ?').run(name ?? existing.name, enabled ? 1 : 0, JSON.stringify(config), new Date().toISOString(), user.name, existing.id)
  return { agent: await loadAiAgent(existing.id) }
})
