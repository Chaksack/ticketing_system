export default defineEventHandler(async (event) => {
  await requireBilling(event)

  const clientId = getRouterParam(event, 'id')
  const invoiceId = getRouterParam(event, 'invoiceId')

  if (!clientId || !invoiceId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing client or invoice id' })
  }

  await ensureDb()
  const db = useDatabase()

  const existing = await db.prepare('SELECT id FROM invoices WHERE id = ? AND client_id = ?').get(invoiceId, clientId)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Invoice not found' })
  }

  await db.prepare('DELETE FROM receipts WHERE invoice_id = ?').run(invoiceId)
  await db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(invoiceId)
  await db.prepare('DELETE FROM invoice_activity WHERE invoice_id = ?').run(invoiceId)
  await db.prepare('DELETE FROM invoices WHERE id = ?').run(invoiceId)

  const client = await loadFullClient(clientId)
  return { client, invoiceId }
})
