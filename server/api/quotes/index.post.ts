import type { RegardingType } from '../../../app/types/interaction'

interface NewLineItemBody {
  productId?: string
  productName?: string
  unitPrice?: number
  currency?: string
  quantity?: number
}

interface NewQuoteBody {
  regardingType?: RegardingType
  regardingId?: string
  notes?: string
  lineItems?: NewLineItemBody[]
}

export default defineEventHandler(async (event) => {
  const user = await requireBd(event)
  const body = await readBody<NewQuoteBody>(event)

  if ((body?.regardingType !== 'lead' && body?.regardingType !== 'tender') || !body?.regardingId?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'regardingType (lead or tender) and regardingId are required' })
  }

  const lineItems = body.lineItems ?? []
  if (!lineItems.length) {
    throw createError({ statusCode: 400, statusMessage: 'At least one line item is required' })
  }
  for (const item of lineItems) {
    if (!item.productName?.trim() || item.unitPrice === undefined || item.unitPrice < 0) {
      throw createError({ statusCode: 400, statusMessage: 'Each line item needs a productName and a non-negative unitPrice' })
    }
  }

  await ensureDb()
  const db = useDatabase()

  const table = body.regardingType === 'lead' ? 'leads' : 'tenders'
  const record = await db.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(body.regardingId)
  if (!record) {
    throw createError({ statusCode: 404, statusMessage: `${body.regardingType} not found` })
  }

  const id = await nextQuoteId()
  const now = new Date().toISOString()

  await db.prepare(`
    INSERT INTO quotes (id, regarding_type, regarding_id, status, notes, created_by, created_at, updated_at)
    VALUES (?, ?, ?, 'quoted', ?, ?, ?, ?)
  `).run(id, body.regardingType, body.regardingId, body.notes?.trim() || null, user.id, now, now)

  for (const item of lineItems) {
    const itemId = await nextQuoteLineItemId()
    await db.prepare(`
      INSERT INTO quote_line_items (id, quote_id, product_id, product_name, unit_price, currency, quantity, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(itemId, id, item.productId ?? null, item.productName!.trim(), item.unitPrice, item.currency?.trim() || 'GHS', item.quantity && item.quantity > 0 ? item.quantity : 1, now)
  }

  const quote = await loadFullQuote(id)

  setResponseStatus(event, 201)
  return { quote }
})
