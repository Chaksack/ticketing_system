import type { WorkOrderRow } from '../../../utils/field'

/**
 * Work orders. `from`/`to` (ISO) narrow to those scheduled in that window — plus every
 * unscheduled one, which the schedule board lists on the left. `mine=1` is a technician's own list.
 */
export default defineEventHandler(async (event) => {
  const user = await requireFieldStaff(event)
  await ensureDb()

  const query = getQuery(event)
  const where: string[] = []
  const params: string[] = []
  if (typeof query.from === 'string' && typeof query.to === 'string') {
    where.push('(work_orders.status = \'unscheduled\' OR (work_orders.scheduled_start >= ? AND work_orders.scheduled_start < ?))')
    params.push(new Date(query.from).toISOString(), new Date(query.to).toISOString())
  }
  if (query.mine === '1' || !isDispatcher(user)) {
    where.push('work_orders.technician_id = ?')
    params.push(user.id)
  }

  const rows = await useTenantDb().prepare(`${WORK_ORDER_SELECT}${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY COALESCE(work_orders.scheduled_start, work_orders.created_at) DESC`).all(...params) as WorkOrderRow[]
  return { workOrders: rows.map(mapWorkOrderRow) }
})
