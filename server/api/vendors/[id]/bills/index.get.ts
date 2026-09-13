export default defineEventHandler(async (event) => {
  await requireFinance(event)
  await ensureDb()

  const vendorId = getRouterParam(event, 'id')
  if (!vendorId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing vendor id' })
  }

  const bills = await getBillsForVendor(vendorId)
  return { bills }
})
