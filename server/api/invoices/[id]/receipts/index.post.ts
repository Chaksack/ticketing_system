import type { ReceiptMethod } from '../../../../../app/types/invoice'
import type { InvoiceRow } from '../../../../utils/invoices'

interface NewReceiptBody {
  amount?: number
  method?: ReceiptMethod
  reference?: string
  receivedAt?: string
}

const VALID_METHODS: ReceiptMethod[] = ['cash', 'bank_transfer', 'cheque', 'mobile_money', 'card', 'other']

export default defineEventHandler(async (event) => {
  const user = await requireBilling(event)

  const invoiceId = getRouterParam(event, 'id')
  const body = await readBody<NewReceiptBody>(event)

  if (!invoiceId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing invoice id' })
  }

  if (body?.amount === undefined || body.amount <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'A positive amount is required' })
  }

  if (!body.method || !VALID_METHODS.includes(body.method)) {
    throw createError({ statusCode: 400, statusMessage: 'A valid payment method is required' })
  }

  await ensureDb()
  const db = useDatabase()

  const invoiceRow = await db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId) as InvoiceRow | undefined
  if (!invoiceRow) {
    throw createError({ statusCode: 404, statusMessage: 'Invoice not found' })
  }

  const id = await nextReceiptId()
  const now = new Date().toISOString()
  const receivedAt = body.receivedAt ?? now

  // Posted before the receipt itself is written — if the ledger rejects it (e.g. a closed fiscal
  // period), nothing is recorded, so a receipt can never exist without its matching GL entry.
  await postReceiptToLedger({ id, amount: body.amount, receivedAt, recordedBy: user.id }, { id: invoiceId })

  await db.prepare(`
    INSERT INTO receipts (id, invoice_id, amount, method, received_date, reference, recorded_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, invoiceId, body.amount, body.method, receivedAt, body.reference?.trim() || null, user.id, now)

  await recalculateInvoiceTotals(invoiceId)

  await logInvoiceActivity({
    invoiceId,
    type: 'payment_received',
    actorId: user.id,
    actorName: user.name,
    toValue: `${body.amount.toLocaleString()} ${invoiceRow.currency}`,
    message: `Payment of ${body.amount.toLocaleString()} ${invoiceRow.currency} recorded`,
  })

  const [client, invoice] = await Promise.all([loadFullClient(invoiceRow.client_id), loadFullInvoice(invoiceId)])

  setResponseStatus(event, 201)
  return { client, invoice }
})
