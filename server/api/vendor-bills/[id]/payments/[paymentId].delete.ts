import type { VendorBillRow } from '../../../../utils/vendorBills'

export default defineEventHandler(async (event) => {
  await requireFinance(event)

  const billId = getRouterParam(event, 'id')
  const paymentId = getRouterParam(event, 'paymentId')

  if (!billId || !paymentId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing vendor bill or payment id' })
  }

  await ensureDb()
  const db = useDatabase()

  const billRow = await db.prepare('SELECT * FROM vendor_bills WHERE id = ?').get(billId) as VendorBillRow | undefined
  if (!billRow) {
    throw createError({ statusCode: 404, statusMessage: 'Vendor bill not found' })
  }

  await db.prepare('DELETE FROM vendor_payments WHERE id = ? AND bill_id = ?').run(paymentId, billId)
  await deleteJournalEntryBySource('vendor_payment', paymentId)
  await recalculateVendorBillTotals(billId)

  const bill = await loadFullVendorBill(billId)
  return { bill }
})
