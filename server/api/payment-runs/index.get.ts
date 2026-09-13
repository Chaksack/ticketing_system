export default defineEventHandler(async (event) => {
  await requireFinance(event)
  await ensureDb()

  const runs = await getAllPaymentRuns()
  return { runs }
})
