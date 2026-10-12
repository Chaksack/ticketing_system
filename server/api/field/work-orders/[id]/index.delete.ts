export default defineEventHandler(async (event) => {
  await requireDispatcher(event)
  const id = getRouterParam(event, 'id') ?? ''
  await ensureDb()

  const workOrder = await loadWorkOrder(id)
  if (!workOrder)
    throw createError({ statusCode: 404, statusMessage: 'Work order not found' })
  if (!['unscheduled', 'scheduled', 'cancelled'].includes(workOrder.status))
    throw createError({ statusCode: 409, statusMessage: 'Work has started on this order — cancel it instead of deleting' })

  await useTenantDb().prepare('DELETE FROM work_orders WHERE id = ?').run(id)
  return { ok: true }
})
