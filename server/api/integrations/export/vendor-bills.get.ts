const HOUR_MS = 60 * 60 * 1000

export default defineEventHandler(async (event) => {
  const apiKey = await requireApiKey(event, 'vendor_bills')

  const limit = await checkRateLimit('erp-export', apiKey.id, 300, HOUR_MS)
  if (!limit.allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests — please slow down.' })
  }

  await ensureDb()
  const items = await getAllVendorBills()

  return { resource: 'vendor_bills', count: items.length, items }
})
