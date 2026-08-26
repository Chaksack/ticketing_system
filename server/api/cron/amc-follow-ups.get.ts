export default defineEventHandler(async (event) => {
  requireCronAuth(event)

  const result = await checkAmcFollowUps()
  return { ok: true, ...result }
})
