export default defineEventHandler(async (event) => {
  await requirePlatformStaff(event)
  return { onboarding: await getOnboarding(getRouterParam(event, 'id')!) }
})
