export default defineEventHandler(async (event) => {
  await requireFinance(event)
  await ensureDb()

  const bills = await getAllVendorBills()
  const outstandingByCurrency = computeOutstandingByCurrency(bills)

  return { bills, outstandingByCurrency }
})
