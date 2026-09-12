export default defineEventHandler(async (event) => {
  await requireBilling(event)
  await ensureDb()

  const invoices = await getAllInvoices()
  const balanceByCurrency = computeBalanceByCurrency(invoices)

  return { invoices, balanceByCurrency }
})
