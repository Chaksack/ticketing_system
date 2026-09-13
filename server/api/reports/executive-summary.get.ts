export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  await ensureDb()

  return await getExecutiveSummary()
})
