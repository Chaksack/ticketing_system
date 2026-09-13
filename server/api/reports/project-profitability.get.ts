export default defineEventHandler(async (event) => {
  await requireFinance(event)
  await ensureDb()

  const query = getQuery(event)
  const projectId = typeof query.projectId === 'string' && query.projectId ? query.projectId : undefined

  const rows = await getProjectProfitability(projectId)
  return { rows }
})
