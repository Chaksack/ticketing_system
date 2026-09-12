import type { InvoiceRow } from '../../../../utils/invoices'

export default defineEventHandler(async (event) => {
  const user = await requireBilling(event)

  const invoiceId = getRouterParam(event, 'id')
  const receiptId = getRouterParam(event, 'receiptId')

  if (!invoiceId || !receiptId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing invoice or receipt id' })
  }

  await ensureDb()
  const db = useDatabase()

  const invoiceRow = await db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId) as InvoiceRow | undefined
  if (!invoiceRow) {
    throw createError({ statusCode: 404, statusMessage: 'Invoice not found' })
  }

  const receipt = await db.prepare('SELECT amount FROM receipts WHERE id = ? AND invoice_id = ?').get(receiptId, invoiceId) as { amount: number | string } | undefined

  await db.prepare('DELETE FROM receipts WHERE id = ? AND invoice_id = ?').run(receiptId, invoiceId)
  await deleteJournalEntryBySource('receipt', receiptId)
  await recalculateInvoiceTotals(invoiceId)

  if (receipt) {
    await logInvoiceActivity({
      invoiceId,
      type: 'payment_removed',
      actorId: user.id,
      actorName: user.name,
      fromValue: `${Number(receipt.amount).toLocaleString()} ${invoiceRow.currency}`,
      message: `Payment of ${Number(receipt.amount).toLocaleString()} ${invoiceRow.currency} removed`,
    })
  }

  const [client, invoice] = await Promise.all([loadFullClient(invoiceRow.client_id), loadFullInvoice(invoiceId)])
  return { client, invoice }
})
