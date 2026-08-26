export default defineEventHandler(async (event) => {
  requireCronAuth(event)

  const result = await checkLeadReminders()
  return { ok: true, ...result }
})
