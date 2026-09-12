export default defineEventHandler(async (event) => {
  await requireFinance(event)
  await ensureDb()

  const entries = await getAllJournalEntries()
  return { entries }
})
