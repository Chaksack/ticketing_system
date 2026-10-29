export default defineEventHandler(async (event) => {
  await requireServiceStaff(event)
  await ensureDb()
  return { model: await getAiModelSettings() }
})
