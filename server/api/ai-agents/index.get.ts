/** AI agents with their last-30-day numbers, plus the model connection and knowledge products to pick from. */
export default defineEventHandler(async (event) => {
  await requireServiceStaff(event)
  await ensureDb()
  const agents = await listAiAgents()
  const stats = Object.fromEntries(await Promise.all(agents.map(async agent => [agent.id, await agentStats(agent.id)] as const)))
  const products = await useTenantDb().prepare('SELECT products FROM kb_articles WHERE status = \'published\' AND products IS NOT NULL').all() as { products: string }[]
  return {
    agents,
    stats,
    model: await getAiModelSettings(),
    products: [...new Set(products.flatMap(row => row.products.split(',').map(p => p.trim()).filter(Boolean)))].sort(),
  }
})
