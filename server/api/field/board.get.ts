import type { WorkOrderRow } from '../../utils/field'

/** Everything the schedule board needs for one day: technicians, their time off, and the work orders. */
export default defineEventHandler(async (event) => {
  await requireDispatcher(event)
  await ensureDb()

  const query = getQuery(event)
  const from = new Date(String(query.from ?? ''))
  const to = new Date(String(query.to ?? ''))
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()))
    throw createError({ statusCode: 400, statusMessage: 'from and to are required' })

  const rows = await useTenantDb().prepare(`${WORK_ORDER_SELECT} WHERE work_orders.status = 'unscheduled' OR (work_orders.scheduled_start >= ? AND work_orders.scheduled_start < ? AND work_orders.status <> 'cancelled')`).all(from.toISOString(), to.toISOString()) as WorkOrderRow[]
  return {
    technicians: await listTechnicians(),
    unavailability: await listUnavailability(from.toISOString(), to.toISOString()),
    workOrders: rows.map(mapWorkOrderRow),
  }
})
