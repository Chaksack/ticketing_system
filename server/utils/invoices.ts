import type { Client } from '../../app/types/client'
import type { Invoice, InvoiceActivity, InvoiceActivityType, InvoiceLineItem, Receipt } from '../../app/types/invoice'

// A heuristic, not a precise measure — same "rough, documented" spirit as PROJECT_STATUS_PROGRESS
// and WEEKLY_CAPACITY_HOURS elsewhere in this app. A discount above this share of the invoice's
// subtotal is large enough to need a second pair of eyes before it goes out.
export const DISCOUNT_APPROVAL_THRESHOLD_PCT = 15

export interface NewInvoiceLineItemInput {
  description?: string
  quantity?: number
  unitPrice?: number
}

export interface NewInvoiceInput {
  projectId?: string
  currency?: string
  taxRate?: number
  discount?: number
  dueAt?: string
  notes?: string
  lineItems?: NewInvoiceLineItemInput[]
}

export function computeInvoiceSubtotal(lineItems: NewInvoiceLineItemInput[]): number {
  return lineItems.reduce((sum, item) => sum + (item.unitPrice ?? 0) * (item.quantity && item.quantity > 0 ? item.quantity : 1), 0)
}

export interface InvoiceLineItemRow {
  id: string
  invoice_id: string
  description: string
  quantity: number | string
  unit_price: number | string
  line_total: number | string
  created_at: string
}

export function mapInvoiceLineItemRow(row: InvoiceLineItemRow): InvoiceLineItem {
  return {
    id: row.id,
    description: row.description,
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
    lineTotal: Number(row.line_total),
    createdAt: row.created_at,
  }
}

export interface InvoiceActivityRow {
  id: string
  invoice_id: string
  type: string
  actor_id: string | null
  actor_name: string | null
  from_value: string | null
  to_value: string | null
  message: string | null
  created_at: string
}

export function mapInvoiceActivityRow(row: InvoiceActivityRow): InvoiceActivity {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    type: row.type as InvoiceActivityType,
    actorId: row.actor_id ?? undefined,
    actorName: row.actor_name ?? undefined,
    fromValue: row.from_value ?? undefined,
    toValue: row.to_value ?? undefined,
    message: row.message ?? undefined,
    createdAt: row.created_at,
  }
}

export interface ReceiptRow {
  id: string
  invoice_id: string
  amount: number | string
  method: string
  received_date: string
  reference: string | null
  recorded_by: string | null
  recorded_by_name?: string | null
  created_at: string
}

export function mapReceiptRow(row: ReceiptRow): Receipt {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    amount: Number(row.amount),
    method: row.method as Receipt['method'],
    receivedAt: row.received_date,
    reference: row.reference ?? undefined,
    recordedBy: row.recorded_by ?? undefined,
    recordedByName: row.recorded_by_name ?? undefined,
    createdAt: row.created_at,
  }
}

export interface InvoiceRow {
  id: string
  client_id: string
  client_name?: string | null
  project_id: string | null
  status: string
  issue_date: string | null
  due_date: string | null
  notes: string | null
  currency: string
  subtotal: number | string
  tax_rate: number | string
  tax_amount: number | string
  discount: number | string
  total: number | string
  amount_paid: number | string
  balance: number | string
  created_by: string | null
  created_by_name?: string | null
  created_at: string
  updated_at: string
}

export function mapInvoiceRow(row: InvoiceRow, lineItems: InvoiceLineItem[] = [], receipts: Receipt[] = [], activity: InvoiceActivity[] = []): Invoice {
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.client_name ?? undefined,
    projectId: row.project_id ?? undefined,
    status: row.status as Invoice['status'],
    issuedAt: row.issue_date ?? undefined,
    dueAt: row.due_date ?? undefined,
    notes: row.notes ?? undefined,
    currency: row.currency,
    subtotal: Number(row.subtotal),
    taxRate: Number(row.tax_rate),
    taxAmount: Number(row.tax_amount),
    discount: Number(row.discount),
    total: Number(row.total),
    amountPaid: Number(row.amount_paid),
    balance: Number(row.balance),
    lineItems,
    receipts,
    activity,
    createdBy: row.created_by ?? undefined,
    createdByName: row.created_by_name ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function logInvoiceActivity(options: {
  invoiceId: string
  type: InvoiceActivityType
  actorId?: string
  actorName?: string
  fromValue?: string
  toValue?: string
  message?: string
}) {
  const db = useDatabase()
  const id = await nextInvoiceActivityId()
  const now = new Date().toISOString()

  await db.prepare(`
    INSERT INTO invoice_activity (id, invoice_id, type, actor_id, actor_name, from_value, to_value, message, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, options.invoiceId, options.type, options.actorId ?? null, options.actorName ?? null, options.fromValue ?? null, options.toValue ?? null, options.message ?? null, now)
}

/** Recomputes amount_paid/balance/status from the invoice's receipts and persists them. */
export async function recalculateInvoiceTotals(invoiceId: string) {
  const db = useDatabase()

  const invoice = await db.prepare('SELECT total FROM invoices WHERE id = ?').get(invoiceId) as { total: number | string } | undefined
  if (!invoice)
    return

  const total = Number(invoice.total)
  const receiptRows = await db.prepare('SELECT amount FROM receipts WHERE invoice_id = ?').all(invoiceId) as { amount: number | string }[]
  const amountPaid = receiptRows.reduce((sum, row) => sum + Number(row.amount), 0)
  const balance = Math.max(total - amountPaid, 0)
  const status: Invoice['status'] = amountPaid <= 0 ? 'unpaid' : balance > 0 ? 'partial' : 'paid'

  await db.prepare('UPDATE invoices SET amount_paid = ?, balance = ?, status = ?, updated_at = ? WHERE id = ?')
    .run(amountPaid, balance, status, new Date().toISOString(), invoiceId)
}

export async function loadFullInvoice(id: string): Promise<Invoice> {
  const db = useDatabase()

  const row = await db.prepare(`
    SELECT invoices.*, staff.name AS created_by_name, clients.name AS client_name
    FROM invoices
    LEFT JOIN staff ON staff.id = invoices.created_by
    LEFT JOIN clients ON clients.id = invoices.client_id
    WHERE invoices.id = ?
  `).get(id) as InvoiceRow | undefined

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Invoice not found' })
  }

  const [lineItemRows, receiptRows, activityRows] = await Promise.all([
    db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY created_at ASC').all(id) as Promise<InvoiceLineItemRow[]>,
    db.prepare(`
      SELECT receipts.*, staff.name AS recorded_by_name
      FROM receipts
      LEFT JOIN staff ON staff.id = receipts.recorded_by
      WHERE receipts.invoice_id = ?
      ORDER BY receipts.received_date ASC
    `).all(id) as Promise<ReceiptRow[]>,
    db.prepare('SELECT * FROM invoice_activity WHERE invoice_id = ? ORDER BY created_at ASC').all(id) as Promise<InvoiceActivityRow[]>,
  ])

  return mapInvoiceRow(
    row,
    lineItemRows.map(lineItemRow => mapInvoiceLineItemRow(lineItemRow)),
    receiptRows.map(receiptRow => mapReceiptRow(receiptRow)),
    activityRows.map(activityRow => mapInvoiceActivityRow(activityRow)),
  )
}

export async function getInvoicesForClient(clientId: string): Promise<Invoice[]> {
  const db = useDatabase()

  const rows = await db.prepare(`
    SELECT invoices.*, staff.name AS created_by_name
    FROM invoices
    LEFT JOIN staff ON staff.id = invoices.created_by
    WHERE invoices.client_id = ?
    ORDER BY invoices.created_at DESC
  `).all(clientId) as InvoiceRow[]

  const invoices: Invoice[] = []
  for (const row of rows)
    invoices.push(await loadFullInvoice(row.id))

  return invoices
}

/**
 * Lightweight list across every client — no nested line items/receipts/activity, matching the
 * list-vs-detail convention used by leads/tenders (fetchLeads() is light, fetchLead(id) is full).
 */
export async function getAllInvoices(): Promise<Invoice[]> {
  const db = useDatabase()

  const rows = await db.prepare(`
    SELECT invoices.*, staff.name AS created_by_name, clients.name AS client_name
    FROM invoices
    LEFT JOIN staff ON staff.id = invoices.created_by
    LEFT JOIN clients ON clients.id = invoices.client_id
    ORDER BY invoices.created_at DESC
  `).all() as InvoiceRow[]

  return rows.map(row => mapInvoiceRow(row))
}

/**
 * Creates an invoice for a client — the one implementation shared by the ad-hoc "New Invoice"
 * form (server/api/clients/[id]/invoices/index.post.ts) and Sales-Order-generated invoices
 * (server/api/sales-orders/[id]/generate-invoice.post.ts), including when either arrives via an
 * approved discount-approval request. Callers are responsible for the discount-threshold check —
 * this function always creates immediately.
 */
export async function createInvoiceForClient(clientId: string, payload: NewInvoiceInput, actor: { id: string, name: string }): Promise<{ client: Client, invoice: Invoice }> {
  const lineItems = payload.lineItems ?? []
  if (!lineItems.length) {
    throw createError({ statusCode: 400, statusMessage: 'At least one line item is required' })
  }
  for (const item of lineItems) {
    if (!item.description?.trim() || item.unitPrice === undefined || item.unitPrice < 0) {
      throw createError({ statusCode: 400, statusMessage: 'Each line item needs a description and a non-negative unitPrice' })
    }
  }

  const db = useDatabase()

  const client = await db.prepare('SELECT id FROM clients WHERE id = ?').get(clientId)
  if (!client) {
    throw createError({ statusCode: 404, statusMessage: 'Client not found' })
  }

  const taxRate = payload.taxRate ?? 0
  const discount = payload.discount ?? 0
  const subtotal = computeInvoiceSubtotal(lineItems)
  const taxAmount = subtotal * (taxRate / 100)
  const total = Math.max(subtotal + taxAmount - discount, 0)
  const currency = payload.currency?.trim() || 'GHS'

  const id = await nextInvoiceId()
  const now = new Date().toISOString()

  await db.prepare(`
    INSERT INTO invoices (id, client_id, project_id, status, issue_date, due_date, notes, currency, subtotal, tax_rate, tax_amount, discount, total, amount_paid, balance, created_by, created_at, updated_at)
    VALUES (?, ?, ?, 'unpaid', ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
  `).run(id, clientId, payload.projectId ?? null, now, payload.dueAt ?? null, payload.notes?.trim() || null, currency, subtotal, taxRate, taxAmount, discount, total, total, actor.id, now, now)

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
    actorId: actor.id,
    actorName: actor.name,
    toValue: `${total.toLocaleString()} ${currency}`,
    message: `Invoice created for ${total.toLocaleString()} ${currency}`,
  })

  const [updatedClient, invoice] = await Promise.all([loadFullClient(clientId), loadFullInvoice(id)])

  return { client: updatedClient, invoice }
}

export function computeBalanceByCurrency(invoices: Invoice[]): { currency: string, balance: number }[] {
  const totals = new Map<string, number>()
  for (const invoice of invoices) {
    if (invoice.balance <= 0)
      continue
    totals.set(invoice.currency, (totals.get(invoice.currency) ?? 0) + invoice.balance)
  }
  return [...totals.entries()].map(([currency, balance]) => ({ currency, balance }))
}
