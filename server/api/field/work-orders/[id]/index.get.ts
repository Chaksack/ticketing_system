import type { WorkOrderDetail } from '../../../../../app/types/field'
import type { WorkOrderRow } from '../../../../utils/field'

export default defineEventHandler(async (event): Promise<{ workOrder: WorkOrderDetail }> => {
  const user = await requireFieldStaff(event)
  await ensureDb()

  const workOrder = await loadWorkOrder(getRouterParam(event, 'id') ?? '')
  if (!workOrder || (!isDispatcher(user) && workOrder.technicianId !== user.id))
    throw createError({ statusCode: 404, statusMessage: 'Work order not found' })

  const history = workOrder.assetId
    ? await useTenantDb().prepare(`${WORK_ORDER_SELECT} WHERE work_orders.asset_id = ? AND work_orders.id <> ? ORDER BY COALESCE(work_orders.completed_at, work_orders.created_at) DESC LIMIT 10`).all(workOrder.assetId, workOrder.id) as WorkOrderRow[]
    : []

  return {
    workOrder: {
      ...workOrder,
      assetHistory: history.map(mapWorkOrderRow).map(w => ({ id: w.id, title: w.title, status: w.status, completedAt: w.completedAt, resolutionNotes: w.resolutionNotes, technicianName: w.technicianName })),
    },
  }
})
