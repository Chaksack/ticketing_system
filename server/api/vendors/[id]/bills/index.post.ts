interface NewLineItemBody {
  description?: string
  quantity?: number
  unitPrice?: number
}

interface NewVendorBillBody {
  expenseAccountCode?: string
  currency?: string
  taxRate?: number
  billDate?: string
  dueAt?: string
  reference?: string
  notes?: string
  lineItems?: NewLineItemBody[]
}

export default defineEventHandler(async (event) => {
  const user = await requireFinance(event)

  const vendorId = getRouterParam(event, 'id')
  const body = await readBody<NewVendorBillBody>(event)

  if (!vendorId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing vendor id' })
  }

  if (!body?.expenseAccountCode?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'expenseAccountCode is required' })
  }

  const lineItems = body.lineItems ?? []
  if (!lineItems.length) {
    throw createError({ statusCode: 400, statusMessage: 'At least one line item is required' })
  }
  for (const item of lineItems) {
    if (!item.description?.trim() || item.unitPrice === undefined || item.unitPrice < 0) {
      throw createError({ statusCode: 400, statusMessage: 'Each line item needs a description and a non-negative unitPrice' })
    }
  }

  await ensureDb()
  const db = useDatabase()

  const vendor = await db.prepare('SELECT id FROM vendors WHERE id = ?').get(vendorId)
  if (!vendor) {
    throw createError({ statusCode: 404, statusMessage: 'Vendor not found' })
  }

  const expenseAccountCode = body.expenseAccountCode.trim()
  const account = await db.prepare('SELECT code FROM accounts WHERE code = ?').get(expenseAccountCode)
  if (!account) {
    throw createError({ statusCode: 400, statusMessage: `Unknown account code: ${expenseAccountCode}` })
  }

  const taxRate = body.taxRate ?? 0
  const subtotal = lineItems.reduce((sum, item) => sum + item.unitPrice! * (item.quantity && item.quantity > 0 ? item.quantity : 1), 0)
  const taxAmount = subtotal * (taxRate / 100)
  const total = Math.max(subtotal + taxAmount, 0)

  const id = await nextVendorBillId()
  const now = new Date().toISOString()
  const billDate = body.billDate || now
  const currency = body.currency?.trim() || 'GHS'

  // Posted before the bill row exists — if the ledger rejects it (e.g. a closed fiscal period),
  // nothing is recorded, mirroring the same guarantee receipts/index.post.ts makes for AR.
  await postVendorBillToLedger({ id, expenseAccountCode, total, billDate, createdBy: user.id })

  await db.prepare(`
    INSERT INTO vendor_bills (id, vendor_id, expense_account_code, status, bill_date, due_date, reference, notes, currency, subtotal, tax_rate, tax_amount, total, amount_paid, balance, created_by, created_at, updated_at)
    VALUES (?, ?, ?, 'unpaid', ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
  `).run(id, vendorId, expenseAccountCode, billDate, body.dueAt ?? null, body.reference?.trim() || null, body.notes?.trim() || null, currency, subtotal, taxRate, taxAmount, total, total, user.id, now, now)

  for (const item of lineItems) {
    const itemId = await nextVendorBillItemId()
    const quantity = item.quantity && item.quantity > 0 ? item.quantity : 1
    const lineTotal = item.unitPrice! * quantity
    await db.prepare(`
      INSERT INTO vendor_bill_items (id, bill_id, description, quantity, unit_price, line_total, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(itemId, id, item.description!.trim(), quantity, item.unitPrice, lineTotal, now)
  }

  const bill = await loadFullVendorBill(id)

  setResponseStatus(event, 201)
  return { bill }
})
