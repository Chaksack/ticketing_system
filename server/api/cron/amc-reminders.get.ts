export default defineEventHandler(async (event) => {
  requireCronAuth(event)

  await ensureDb()
  const result = await checkAmcRenewals()
  return { ok: true, ...result }
})
