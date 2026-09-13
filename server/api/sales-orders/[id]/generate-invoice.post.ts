import type { NewInvoiceInput } from '../../../utils/invoices'
import type { LineItemRow } from '../../../utils/products'
import type { SalesOrderRow } from '../../../utils/salesOrders'

interface GenerateInvoiceBody {
  projectId?: string
  taxRate?: number
  discount?: number
  dueAt?: string
  notes?: string
}

export default defineEventHandler(async (event) => {
  const user = await requireBilling(event)

  const orderId = getRouterParam(event, 'id')
  const body = await readBody<GenerateInvoiceBody>(event)

  if (!orderId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing sales order id' })
  }

  await ensureDb()
  const db = useDatabase()

  const order = await db.prepare('SELECT * FROM sales_orders WHERE id = ?').get(orderId) as SalesOrderRow | undefined
  if (!order) {
    throw createError({ statusCode: 404, statusMessage: 'Sales order not found' })
  }
  if (order.status !== 'confirmed') {
    throw createError({ statusCode: 409, statusMessage: `Order is already ${order.status}` })
  }

  // An order against a lead/tender can only be billed once that lead/tender has actually become
  // a client (converted_client_id) — invoicing needs a real client to bill, and this app never
  // creates a quote directly against a client (see server/api/quotes/index.post.ts).
  let clientId: string | null = null
  if (order.regarding_type === 'client') {
    clientId = order.regarding_id
  }
  else if (order.regarding_type === 'lead') {
    const lead = await db.prepare('SELECT converted_client_id FROM leads WHERE id = ?').get(order.regarding_id) as { converted_client_id: string | null } | undefined
    clientId = lead?.converted_client_id ?? null
  }
  else if (order.regarding_type === 'tender') {
    const tender = await db.prepare('SELECT converted_client_id FROM tenders WHERE id = ?').get(order.regarding_id) as { converted_client_id: string | null } | undefined
    clientId = tender?.converted_client_id ?? null
  }

  if (!clientId) {
    throw createError({ statusCode: 400, statusMessage: 'This order\'s lead/tender hasn\'t been converted to a client yet — convert it first, then generate the invoice.' })
  }

  const lineItemRows = await db.prepare('SELECT * FROM sales_order_line_items WHERE order_id = ? ORDER BY created_at ASC').all(orderId) as LineItemRow[]

  const invoicePayload: NewInvoiceInput = {
    projectId: body.projectId,
    currency: order.currency,
    taxRate: body.taxRate,
    discount: body.discount,
    dueAt: body.dueAt,
    notes: body.notes,
    lineItems: lineItemRows.map(item => ({
      description: item.product_name,
      quantity: item.quantity,
      unitPrice: Number(item.unit_price),
    })),
  }

  const discount = body.discount ?? 0
  const subtotal = computeInvoiceSubtotal(invoicePayload.lineItems!)
  const discountPct = subtotal > 0 ? (discount / subtotal) * 100 : 0

  if (discountPct > DISCOUNT_APPROVAL_THRESHOLD_PCT) {
    const client = await db.prepare('SELECT name FROM clients WHERE id = ?').get(clientId) as { name: string } | undefined
    const approval = await createApprovalRequest({
      type: 'invoice_discount',
      subjectLabel: `Invoice for ${client?.name ?? clientId} (Order ${orderId}) — ${discountPct.toFixed(0)}% discount`,
      payload: { clientId, invoicePayload, requestedBy: user.id, requestedByName: user.name, salesOrderId: orderId },
      requestedBy: user.id,
    })

    setResponseStatus(event, 202)
    return { pending: true, approval }
  }

  const { invoice } = await createInvoiceForClient(clientId, invoicePayload, user)
  await markSalesOrderInvoiced(orderId)

  const updatedOrder = await loadFullSalesOrder(orderId)

  setResponseStatus(event, 201)
  return { invoice, order: updatedOrder }
})
