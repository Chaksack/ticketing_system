export default defineEventHandler(async (event) => {
  await requireFinance(event)
  await ensureDb()

  const vendors = await getAllVendors()
  return { vendors }
})
