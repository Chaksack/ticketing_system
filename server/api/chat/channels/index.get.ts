export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  await ensureDb()

  const channels = await getChannelsForUser(user.id)
  return { channels }
})
