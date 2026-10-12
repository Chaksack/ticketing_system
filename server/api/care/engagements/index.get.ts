export default defineEventHandler(async (event) => {
  await requirePlatformStaff(event)
  return { engagements: await listEngagements() }
})
