export default defineEventHandler(async (event) => {
  await requireFinance(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing vendor bill id' })
  }

  await ensureDb()
  const db = useDatabase()

  const existing = await db.prepare('SELECT id FROM vendor_bills WHERE id = ?').get(id)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Vendor bill not found' })
  }

  // Cascades fully, same as clients/[id]/invoices/[invoiceId].delete.ts does for an invoice's
  // receipts — every payment's own GL entry is reversed before the bill's own entry is.
  const paymentRows = await db.prepare('SELECT id FROM vendor_payments WHERE bill_id = ?').all(id) as { id: string }[]
  for (const payment of paymentRows)
    await deleteJournalEntryBySource('vendor_payment', payment.id)

  await db.prepare('DELETE FROM vendor_payments WHERE bill_id = ?').run(id)
  await db.prepare('DELETE FROM vendor_bill_items WHERE bill_id = ?').run(id)
  await deleteJournalEntryBySource('vendor_bill', id)
  await db.prepare('DELETE FROM vendor_bills WHERE id = ?').run(id)

  return { success: true, billId: id }
})
