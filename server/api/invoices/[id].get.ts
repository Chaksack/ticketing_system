export default defineEventHandler(async (event) => {
  await requireBilling(event)
  await ensureDb()

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing invoice id' })
  }

  const invoice = await loadFullInvoice(id)
  return { invoice }
})
