import type { LineItemRow } from '../../../utils/products'
import type { QuoteRow } from '../../../utils/quotes'

export default defineEventHandler(async (event) => {
  const user = await requireBd(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing quote id' })
  }

  await ensureDb()
  const db = useDatabase()

  const quote = await db.prepare('SELECT * FROM quotes WHERE id = ?').get(id) as QuoteRow | undefined
  if (!quote) {
    throw createError({ statusCode: 404, statusMessage: 'Quote not found' })
  }
  if (quote.status !== 'quoted') {
    throw createError({ statusCode: 409, statusMessage: `Quote is already ${quote.status}` })
  }

  const lineItemRows = await db.prepare('SELECT * FROM quote_line_items WHERE quote_id = ? ORDER BY created_at ASC').all(id) as LineItemRow[]
  if (!lineItemRows.length) {
    throw createError({ statusCode: 400, statusMessage: 'Quote has no line items to confirm' })
  }

  // Line items are copied, not referenced — same "snapshot at a point in time" reasoning used
  // everywhere else in this app (e.g. a timesheet's hourly_rate) — so a later edit to the quote
  // never silently changes an order that's already been confirmed.
  const total = lineItemRows.reduce((sum, item) => sum + Number(item.unit_price) * item.quantity, 0)
  const currency = lineItemRows[0]!.currency

  const orderId = await nextSalesOrderId()
  const now = new Date().toISOString()

  await db.prepare(`
    INSERT INTO sales_orders (id, quote_id, regarding_type, regarding_id, status, currency, total, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'confirmed', ?, ?, ?, ?, ?)
  `).run(orderId, id, quote.regarding_type, quote.regarding_id, currency, total, user.id, now, now)

  for (const item of lineItemRows) {
    const itemId = await nextSalesOrderLineItemId()
    await db.prepare(`
      INSERT INTO sales_order_line_items (id, order_id, product_id, product_name, unit_price, currency, quantity, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(itemId, orderId, item.product_id, item.product_name, item.unit_price, item.currency, item.quantity, now)
  }

  await db.prepare(`UPDATE quotes SET status = 'ordered', updated_at = ? WHERE id = ?`).run(now, id)

  const [updatedQuote, order] = await Promise.all([loadFullQuote(id), loadFullSalesOrder(orderId)])

  setResponseStatus(event, 201)
  return { quote: updatedQuote, order }
})
