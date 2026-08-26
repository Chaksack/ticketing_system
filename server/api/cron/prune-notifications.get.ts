export default defineEventHandler(async (event) => {
  requireCronAuth(event)

  const result = await pruneReadNotifications()
  return { ok: true, ...result }
})
