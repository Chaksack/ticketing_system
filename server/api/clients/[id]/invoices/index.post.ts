interface NewLineItemBody {
  description?: string
  quantity?: number
  unitPrice?: number
}

interface NewInvoiceBody {
  projectId?: string
  currency?: string
  taxRate?: number
  discount?: number
  dueAt?: string
  notes?: string
  lineItems?: NewLineItemBody[]
}

export default defineEventHandler(async (event) => {
  const user = await requireBd(event)

  const clientId = getRouterParam(event, 'id')
  const body = await readBody<NewInvoiceBody>(event)

  if (!clientId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing client id' })
  }

  const lineItems = body?.lineItems ?? []
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

  const client = await db.prepare('SELECT id FROM clients WHERE id = ?').get(clientId)
  if (!client) {
    throw createError({ statusCode: 404, statusMessage: 'Client not found' })
  }

  const taxRate = body.taxRate ?? 0
  const discount = body.discount ?? 0
  const subtotal = lineItems.reduce((sum, item) => sum + item.unitPrice! * (item.quantity && item.quantity > 0 ? item.quantity : 1), 0)
  const taxAmount = subtotal * (taxRate / 100)
  const total = Math.max(subtotal + taxAmount - discount, 0)

  const id = await nextInvoiceId()
  const now = new Date().toISOString()

  await db.prepare(`
    INSERT INTO invoices (id, client_id, project_id, status, issue_date, due_date, notes, currency, subtotal, tax_rate, tax_amount, discount, total, amount_paid, balance, created_by, created_at, updated_at)
    VALUES (?, ?, ?, 'unpaid', ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
  `).run(id, clientId, body.projectId ?? null, now, body.dueAt ?? null, body.notes?.trim() || null, body.currency?.trim() || 'GHS', subtotal, taxRate, taxAmount, discount, total, total, user.id, now, now)

  for (const item of lineItems) {
    const itemId = await nextInvoiceItemId()
    const quantity = item.quantity && item.quantity > 0 ? item.quantity : 1
    const lineTotal = item.unitPrice! * quantity
    await db.prepare(`
      INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, line_total, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(itemId, id, item.description!.trim(), quantity, item.unitPrice, lineTotal, now)
  }

  await logInvoiceActivity({
    invoiceId: id,
    type: 'created',
    actorId: user.id,
    actorName: user.name,
    toValue: `${total.toLocaleString()} ${body.currency?.trim() || 'GHS'}`,
    message: `Invoice created for ${total.toLocaleString()} ${body.currency?.trim() || 'GHS'}`,
  })

  const [updatedClient, invoice] = await Promise.all([loadFullClient(clientId), loadFullInvoice(id)])

  setResponseStatus(event, 201)
  return { client: updatedClient, invoice }
})
