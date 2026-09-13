import type { PaymentRun, VendorBill, VendorBillLineItem, VendorPayment } from '../../app/types/vendor-bill'

export interface VendorBillItemRow {
  id: string
  bill_id: string
  description: string
  quantity: number | string
  unit_price: number | string
  line_total: number | string
  created_at: string
}

export function mapVendorBillItemRow(row: VendorBillItemRow): VendorBillLineItem {
  return {
    id: row.id,
    description: row.description,
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
    lineTotal: Number(row.line_total),
    createdAt: row.created_at,
  }
}

export interface VendorPaymentRow {
  id: string
  bill_id: string
  payment_run_id: string | null
  amount: number | string
  method: string
  paid_date: string
  reference: string | null
  recorded_by: string | null
  recorded_by_name?: string | null
  created_at: string
}

export function mapVendorPaymentRow(row: VendorPaymentRow): VendorPayment {
  return {
    id: row.id,
    billId: row.bill_id,
    paymentRunId: row.payment_run_id ?? undefined,
    amount: Number(row.amount),
    method: row.method as VendorPayment['method'],
    paidAt: row.paid_date,
    reference: row.reference ?? undefined,
    recordedBy: row.recorded_by ?? undefined,
    recordedByName: row.recorded_by_name ?? undefined,
    createdAt: row.created_at,
  }
}

export interface VendorBillRow {
  id: string
  vendor_id: string
  vendor_name?: string | null
  expense_account_code: string
  expense_account_name?: string | null
  status: string
  bill_date: string
  due_date: string | null
  reference: string | null
  notes: string | null
  currency: string
  subtotal: number | string
  tax_rate: number | string
  tax_amount: number | string
  total: number | string
  amount_paid: number | string
  balance: number | string
  created_by: string | null
  created_by_name?: string | null
  created_at: string
  updated_at: string
}

export function mapVendorBillRow(row: VendorBillRow, lineItems: VendorBillLineItem[] = [], payments: VendorPayment[] = []): VendorBill {
  return {
    id: row.id,
    vendorId: row.vendor_id,
    vendorName: row.vendor_name ?? undefined,
    expenseAccountCode: row.expense_account_code,
    expenseAccountName: row.expense_account_name ?? undefined,
    status: row.status as VendorBill['status'],
    billDate: row.bill_date,
    dueAt: row.due_date ?? undefined,
    reference: row.reference ?? undefined,
    notes: row.notes ?? undefined,
    currency: row.currency,
    subtotal: Number(row.subtotal),
    taxRate: Number(row.tax_rate),
    taxAmount: Number(row.tax_amount),
    total: Number(row.total),
    amountPaid: Number(row.amount_paid),
    balance: Number(row.balance),
    lineItems,
    payments,
    createdBy: row.created_by ?? undefined,
    createdByName: row.created_by_name ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface PaymentRunRow {
  id: string
  payment_date: string
  method: string
  reference: string | null
  total: number | string
  created_by: string | null
  created_by_name?: string | null
  created_at: string
  bill_count?: number | string
}

export function mapPaymentRunRow(row: PaymentRunRow): PaymentRun {
  return {
    id: row.id,
    paymentDate: row.payment_date,
    method: row.method as PaymentRun['method'],
    reference: row.reference ?? undefined,
    total: Number(row.total),
    billCount: Number(row.bill_count ?? 0),
    createdBy: row.created_by ?? undefined,
    createdByName: row.created_by_name ?? undefined,
    createdAt: row.created_at,
  }
}

/** Recomputes amount_paid/balance/status from the bill's payments and persists them — mirrors recalculateInvoiceTotals in server/utils/invoices.ts. */
export async function recalculateVendorBillTotals(billId: string) {
  const db = useDatabase()

  const bill = await db.prepare('SELECT total FROM vendor_bills WHERE id = ?').get(billId) as { total: number | string } | undefined
  if (!bill)
    return

  const total = Number(bill.total)
  const paymentRows = await db.prepare('SELECT amount FROM vendor_payments WHERE bill_id = ?').all(billId) as { amount: number | string }[]
  const amountPaid = paymentRows.reduce((sum, row) => sum + Number(row.amount), 0)
  const balance = Math.max(total - amountPaid, 0)
  const status: VendorBill['status'] = amountPaid <= 0 ? 'unpaid' : balance > 0 ? 'partial' : 'paid'

  await db.prepare('UPDATE vendor_bills SET amount_paid = ?, balance = ?, status = ?, updated_at = ? WHERE id = ?')
    .run(amountPaid, balance, status, new Date().toISOString(), billId)
}

export async function loadFullVendorBill(id: string): Promise<VendorBill> {
  const db = useDatabase()

  const row = await db.prepare(`
    SELECT vendor_bills.*, staff.name AS created_by_name, vendors.name AS vendor_name, accounts.name AS expense_account_name
    FROM vendor_bills
    LEFT JOIN staff ON staff.id = vendor_bills.created_by
    LEFT JOIN vendors ON vendors.id = vendor_bills.vendor_id
    LEFT JOIN accounts ON accounts.code = vendor_bills.expense_account_code
    WHERE vendor_bills.id = ?
  `).get(id) as VendorBillRow | undefined

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Vendor bill not found' })
  }

  const [itemRows, paymentRows] = await Promise.all([
    db.prepare('SELECT * FROM vendor_bill_items WHERE bill_id = ? ORDER BY created_at ASC').all(id) as Promise<VendorBillItemRow[]>,
    db.prepare(`
      SELECT vendor_payments.*, staff.name AS recorded_by_name
      FROM vendor_payments
      LEFT JOIN staff ON staff.id = vendor_payments.recorded_by
      WHERE vendor_payments.bill_id = ?
      ORDER BY vendor_payments.paid_date ASC
    `).all(id) as Promise<VendorPaymentRow[]>,
  ])

  return mapVendorBillRow(
    row,
    itemRows.map(itemRow => mapVendorBillItemRow(itemRow)),
    paymentRows.map(paymentRow => mapVendorPaymentRow(paymentRow)),
  )
}

export async function getBillsForVendor(vendorId: string): Promise<VendorBill[]> {
  const db = useDatabase()

  const rows = await db.prepare(`
    SELECT vendor_bills.*, staff.name AS created_by_name
    FROM vendor_bills
    WHERE vendor_bills.vendor_id = ?
    ORDER BY vendor_bills.created_at DESC
  `).all(vendorId) as VendorBillRow[]

  const bills: VendorBill[] = []
  for (const row of rows)
    bills.push(await loadFullVendorBill(row.id))

  return bills
}

/** Lightweight list across every vendor — no nested line items/payments, matching the list-vs-detail convention in server/utils/invoices.ts. */
export async function getAllVendorBills(): Promise<VendorBill[]> {
  const db = useDatabase()

  const rows = await db.prepare(`
    SELECT vendor_bills.*, staff.name AS created_by_name, vendors.name AS vendor_name, accounts.name AS expense_account_name
    FROM vendor_bills
    LEFT JOIN staff ON staff.id = vendor_bills.created_by
    LEFT JOIN vendors ON vendors.id = vendor_bills.vendor_id
    LEFT JOIN accounts ON accounts.code = vendor_bills.expense_account_code
    ORDER BY vendor_bills.created_at DESC
  `).all() as VendorBillRow[]

  return rows.map(row => mapVendorBillRow(row))
}

export function computeOutstandingByCurrency(bills: VendorBill[]): { currency: string, balance: number }[] {
  const totals = new Map<string, number>()
  for (const bill of bills) {
    if (bill.balance <= 0)
      continue
    totals.set(bill.currency, (totals.get(bill.currency) ?? 0) + bill.balance)
  }
  return [...totals.entries()].map(([currency, balance]) => ({ currency, balance }))
}

export async function getAllPaymentRuns(): Promise<PaymentRun[]> {
  const db = useDatabase()

  const rows = await db.prepare(`
    SELECT payment_runs.*, staff.name AS created_by_name, COUNT(vendor_payments.id) AS bill_count
    FROM payment_runs
    LEFT JOIN staff ON staff.id = payment_runs.created_by
    LEFT JOIN vendor_payments ON vendor_payments.payment_run_id = payment_runs.id
    GROUP BY payment_runs.id, staff.name
    ORDER BY payment_runs.created_at DESC
  `).all() as PaymentRunRow[]

  return rows.map(mapPaymentRunRow)
}
