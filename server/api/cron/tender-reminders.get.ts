export default defineEventHandler(async (event) => {
  requireCronAuth(event)

  const result = await checkTenderReminders()
  return { ok: true, ...result }
})
