export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const channelId = getRouterParam(event, 'id')

  if (!channelId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing channel id' })
  }

  await ensureDb()

  if (!await isChannelMember(channelId, user.id)) {
    throw createError({ statusCode: 403, statusMessage: 'You are not a member of this channel' })
  }

  const db = useDatabase()
  await db.prepare('UPDATE chat_channel_members SET last_read_at = ? WHERE channel_id = ? AND staff_id = ?').run(new Date().toISOString(), channelId, user.id)

  return { success: true }
})
