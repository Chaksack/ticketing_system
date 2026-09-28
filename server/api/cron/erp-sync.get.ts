export default defineEventHandler(async (event) => {
  requireCronAuth(event)

  const result = await runAllErpSyncs()
  return { ok: true, ...result }
})
