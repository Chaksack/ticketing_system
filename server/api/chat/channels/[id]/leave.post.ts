export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const channelId = getRouterParam(event, 'id')

  if (!channelId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing channel id' })
  }

  await ensureDb()
  const db = useDatabase()

  const channelRow = await db.prepare('SELECT type FROM chat_channels WHERE id = ?').get(channelId) as { type: string } | undefined
  if (!channelRow) {
    throw createError({ statusCode: 404, statusMessage: 'Channel not found' })
  }
  if (channelRow.type !== 'project') {
    throw createError({ statusCode: 400, statusMessage: 'Only project channels can be left this way' })
  }

  await db.prepare('DELETE FROM chat_channel_members WHERE channel_id = ? AND staff_id = ?').run(channelId, user.id)

  return { left: true }
})
