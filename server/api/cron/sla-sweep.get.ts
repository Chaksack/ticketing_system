export default defineEventHandler(async (event) => {
  requireCronAuth(event)

  const result = await runTicketSweep()
  return { ok: true, ...result }
})
