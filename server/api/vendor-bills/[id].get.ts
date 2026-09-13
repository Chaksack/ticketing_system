export default defineEventHandler(async (event) => {
  await requireFinance(event)
  await ensureDb()

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing vendor bill id' })
  }

  const bill = await loadFullVendorBill(id)
  return { bill }
})
