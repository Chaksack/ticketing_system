// Runs once per active company, each in its own database (server/utils/controlPlane.ts).
export default defineEventHandler(async (event) => {
  requireCronAuth(event)

  const results = await forEachActiveOrg('task-reminders', () => checkTaskReminders())
  return { ok: true, results }
})
