export default defineEventHandler(async (event) => {
  await requireFinance(event)
  await ensureDb()

  const accounts = await getAllAccounts()
  return { accounts }
})
