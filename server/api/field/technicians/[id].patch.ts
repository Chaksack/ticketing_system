/** A technician's skills, which auto-schedule matches against each work order's required skill. */
export default defineEventHandler(async (event) => {
  await requireDispatcher(event)
  const id = getRouterParam(event, 'id') ?? ''
  const body = await readBody<{ skills?: string[] }>(event)
  await ensureDb()
  if (!(await listTechnicians()).some(t => t.id === id))
    throw createError({ statusCode: 404, statusMessage: 'Technician not found' })
  const skills = [...new Set((body?.skills ?? []).map(s => s.trim()).filter(Boolean))].slice(0, 20)
  await useTenantDb().prepare('UPDATE staff SET skills = ? WHERE id = ?').run(skills.join(', ') || null, id)
  return { technician: (await listTechnicians()).find(t => t.id === id) }
})
