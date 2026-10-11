export default defineEventHandler(async (event) => {
  await requirePlatformStaff(event)
  return { onboardings: await listOnboardings() }
})
