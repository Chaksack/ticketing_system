import type { RegardingType } from '../../app/types/interaction'
import type { LineItem } from '../../app/types/product'
import type { SalesOrder } from '../../app/types/sales-order'
import type { LineItemRow } from './products'
import { mapLineItemRow } from './products'

export interface SalesOrderRow {
  id: string
  quote_id: string
  regarding_type: string
  regarding_id: string
  status: string
  currency: string
  total: number | string
  notes: string | null
  created_by: string | null
  created_by_name?: string | null
  created_at: string
  updated_at: string
}

export function mapSalesOrderRow(row: SalesOrderRow, lineItems: LineItem[] = []): SalesOrder {
  return {
    id: row.id,
    quoteId: row.quote_id,
    regardingType: row.regarding_type as RegardingType,
    regardingId: row.regarding_id,
    status: row.status as SalesOrder['status'],
    currency: row.currency,
    total: Number(row.total),
    notes: row.notes ?? undefined,
    lineItems,
    createdBy: row.created_by ?? undefined,
    createdByName: row.created_by_name ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function loadFullSalesOrder(id: string): Promise<SalesOrder> {
  const db = useDatabase()

  const row = await db.prepare(`
    SELECT sales_orders.*, staff.name AS created_by_name
    FROM sales_orders
    LEFT JOIN staff ON staff.id = sales_orders.created_by
    WHERE sales_orders.id = ?
  `).get(id) as SalesOrderRow | undefined

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Sales order not found' })
  }

  const lineItemRows = await db.prepare('SELECT * FROM sales_order_line_items WHERE order_id = ? ORDER BY created_at ASC').all(id) as LineItemRow[]

  return mapSalesOrderRow(row, lineItemRows.map(lineItemRow => mapLineItemRow(lineItemRow)))
}

export async function getSalesOrdersForRecord(regardingType: RegardingType, regardingId: string): Promise<SalesOrder[]> {
  const db = useDatabase()

  const rows = await db.prepare(`
    SELECT sales_orders.*, staff.name AS created_by_name
    FROM sales_orders
    LEFT JOIN staff ON staff.id = sales_orders.created_by
    WHERE sales_orders.regarding_type = ? AND sales_orders.regarding_id = ?
    ORDER BY sales_orders.created_at DESC
  `).all(regardingType, regardingId) as SalesOrderRow[]

  const orders: SalesOrder[] = []
  for (const row of rows)
    orders.push(await loadFullSalesOrder(row.id))

  return orders
}

export async function markSalesOrderInvoiced(orderId: string) {
  const db = useDatabase()
  await db.prepare(`UPDATE sales_orders SET status = 'invoiced', updated_at = ? WHERE id = ?`).run(new Date().toISOString(), orderId)
}
