export default defineEventHandler(async (event) => {
  await requireFinance(event)
  await ensureDb()

  const approvals = await getAllApprovals()
  return { approvals }
})
