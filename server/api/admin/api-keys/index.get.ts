export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  await ensureDb()

  const keys = await getAllApiKeys()
  return { keys }
})
