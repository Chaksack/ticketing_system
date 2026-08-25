export default defineEventHandler(async (event) => {
  requireCronAuth(event)

  const result = await checkTaskReminders()
  return { ok: true, ...result }
})
