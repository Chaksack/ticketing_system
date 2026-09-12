export default defineEventHandler(async (event) => {
  await requireBd(event)
  await ensureDb()

  const status = await getConversionModelStatus()
  return { status }
})
