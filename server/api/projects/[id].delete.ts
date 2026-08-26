export default defineEventHandler(async (event) => {
  await requireBd(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing project id' })
  }

  await ensureDb()
  const db = useDatabase()

  const existing = await db.prepare('SELECT id FROM projects WHERE id = ?').get(id)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Project not found' })
  }

  // Keep the AMC contract history — just detach it from the project being removed, mirroring
  // how deleting a task epic nulls epic_id on its tasks rather than deleting them.
  await db.prepare('UPDATE client_amc_contracts SET project_id = NULL WHERE project_id = ?').run(id)
  await db.prepare('DELETE FROM projects WHERE id = ?').run(id)

  return { success: true }
})
