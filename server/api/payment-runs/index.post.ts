import type { VendorPaymentMethod } from '../../../app/types/vendor-bill'
import type { VendorBillRow } from '../../utils/vendorBills'

interface NewPaymentRunBody {
  billIds?: string[]
  method?: VendorPaymentMethod
  paymentDate?: string
  reference?: string
}

const VALID_METHODS: VendorPaymentMethod[] = ['cash', 'bank_transfer', 'cheque', 'mobile_money', 'card', 'other']

export default defineEventHandler(async (event) => {
  const user = await requireFinance(event)

  const body = await readBody<NewPaymentRunBody>(event)

  if (!body?.billIds?.length) {
    throw createError({ statusCode: 400, statusMessage: 'At least one bill is required' })
  }
  if (!body.method || !VALID_METHODS.includes(body.method)) {
    throw createError({ statusCode: 400, statusMessage: 'A valid payment method is required' })
  }

  await ensureDb()
  const db = useDatabase()

  const paymentDate = body.paymentDate || new Date().toISOString()

  // Validate every bill up front — nothing posts unless the whole run is payable.
  const bills: VendorBillRow[] = []
  for (const billId of body.billIds) {
    const row = await db.prepare('SELECT * FROM vendor_bills WHERE id = ?').get(billId) as VendorBillRow | undefined
    if (!row) {
      throw createError({ statusCode: 400, statusMessage: `Unknown vendor bill: ${billId}` })
    }
    if (Number(row.balance) <= 0) {
      throw createError({ statusCode: 400, statusMessage: `Bill ${billId} has no outstanding balance` })
    }
    bills.push(row)
  }

  const runId = await nextPaymentRunId()
  const now = new Date().toISOString()

  await db.prepare(`
    INSERT INTO payment_runs (id, payment_date, method, reference, total, created_by, created_at)
    VALUES (?, ?, ?, ?, 0, ?, ?)
  `).run(runId, paymentDate, body.method, body.reference?.trim() || null, user.id, now)

  // Each bill still gets its own journal entry (not one combined one) so an individual payment
  // stays independently reversible via the existing per-payment delete route — the run is a
  // grouping label over ordinary payments, not a new ledger primitive.
  let total = 0
  for (const bill of bills) {
    const amount = Number(bill.balance)
    const paymentId = await nextVendorPaymentId()

    await postVendorPaymentToLedger({ id: paymentId, billId: bill.id, amount, paidDate: paymentDate, recordedBy: user.id })

    await db.prepare(`
      INSERT INTO vendor_payments (id, bill_id, payment_run_id, amount, method, paid_date, recorded_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(paymentId, bill.id, runId, amount, body.method, paymentDate, user.id, now)

    await recalculateVendorBillTotals(bill.id)
    total += amount
  }

  await db.prepare('UPDATE payment_runs SET total = ? WHERE id = ?').run(total, runId)

  const runs = await getAllPaymentRuns()
  const run = runs.find(r => r.id === runId)

  setResponseStatus(event, 201)
  return { run }
})
