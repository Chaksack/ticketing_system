import type { Invoice, InvoiceActivity, InvoiceActivityType, InvoiceLineItem, Receipt } from '../../app/types/invoice'

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

export function computeBalanceByCurrency(invoices: Invoice[]): { currency: string, balance: number }[] {
  const totals = new Map<string, number>()
  for (const invoice of invoices) {
    if (invoice.balance <= 0)
      continue
    totals.set(invoice.currency, (totals.get(invoice.currency) ?? 0) + invoice.balance)
  }
  return [...totals.entries()].map(([currency, balance]) => ({ currency, balance }))
}
