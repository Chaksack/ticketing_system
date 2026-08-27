export default defineEventHandler(async (event) => {
  requireCronAuth(event)

  const result = await checkMeetingReminders()
  return { ok: true, ...result }
})
