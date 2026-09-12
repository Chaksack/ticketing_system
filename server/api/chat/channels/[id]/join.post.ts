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
    throw createError({ statusCode: 400, statusMessage: 'Only project channels can be joined directly — ask a member to add you instead' })
  }

  if (!await isChannelMember(channelId, user.id)) {
    await db.prepare('INSERT INTO chat_channel_members (channel_id, staff_id, joined_at) VALUES (?, ?, ?)').run(channelId, user.id, new Date().toISOString())
  }

  const channel = await loadChannelForUser(channelId, user.id)
  return { channel }
})
