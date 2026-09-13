import type { VendorPaymentMethod } from '../../../../../app/types/vendor-bill'
import type { VendorBillRow } from '../../../../utils/vendorBills'

interface NewVendorPaymentBody {
  amount?: number
  method?: VendorPaymentMethod
  reference?: string
  paidAt?: string
}

const VALID_METHODS: VendorPaymentMethod[] = ['cash', 'bank_transfer', 'cheque', 'mobile_money', 'card', 'other']

export default defineEventHandler(async (event) => {
  const user = await requireFinance(event)

  const billId = getRouterParam(event, 'id')
  const body = await readBody<NewVendorPaymentBody>(event)

  if (!billId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing vendor bill id' })
  }

  if (body?.amount === undefined || body.amount <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'A positive amount is required' })
  }

  if (!body.method || !VALID_METHODS.includes(body.method)) {
    throw createError({ statusCode: 400, statusMessage: 'A valid payment method is required' })
  }

  await ensureDb()
  const db = useDatabase()

  const billRow = await db.prepare('SELECT * FROM vendor_bills WHERE id = ?').get(billId) as VendorBillRow | undefined
  if (!billRow) {
    throw createError({ statusCode: 404, statusMessage: 'Vendor bill not found' })
  }

  const id = await nextVendorPaymentId()
  const now = new Date().toISOString()
  const paidAt = body.paidAt ?? now

  await postVendorPaymentToLedger({ id, billId, amount: body.amount, paidDate: paidAt, recordedBy: user.id })

  await db.prepare(`
    INSERT INTO vendor_payments (id, bill_id, amount, method, paid_date, reference, recorded_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, billId, body.amount, body.method, paidAt, body.reference?.trim() || null, user.id, now)

  await recalculateVendorBillTotals(billId)

  const bill = await loadFullVendorBill(billId)

  setResponseStatus(event, 201)
  return { bill }
})
