export default defineEventHandler(async (event) => {
  await requireBd(event)

  const projectId = getRouterParam(event, 'id')
  const entryId = getRouterParam(event, 'entryId')
  if (!projectId || !entryId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing project or entry id' })
  }

  await ensureDb()
  const db = useDatabase()

  const existing = await db.prepare('SELECT id FROM project_financial_entries WHERE id = ? AND project_id = ?').get(entryId, projectId)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Entry not found' })
  }

  await db.prepare('DELETE FROM project_financial_entries WHERE id = ?').run(entryId)

  return { project: await loadFullProject(projectId) }
})
