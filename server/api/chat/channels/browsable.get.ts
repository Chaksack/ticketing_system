export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  await ensureDb()

  const channels = await getBrowsableProjectChannels(user.id)
  return { channels }
})
