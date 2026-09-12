export default defineEventHandler(async (event) => {
  requireCronAuth(event)
  await ensureDb()

  const status = await trainConversionModel()
  return { ok: true, status }
})
