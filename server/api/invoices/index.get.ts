export default defineEventHandler(async (event) => {
  await requireBd(event)
  await ensureDb()

  const invoices = await getAllInvoices()
  const balanceByCurrency = computeBalanceByCurrency(invoices)

  return { invoices, balanceByCurrency }
})
