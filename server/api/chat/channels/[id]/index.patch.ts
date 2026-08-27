interface UpdateChannelBody {
  name?: string
  memberIds?: string[]
}

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const channelId = getRouterParam(event, 'id')
  const body = await readBody<UpdateChannelBody>(event)

  if (!channelId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing channel id' })
  }

  await ensureDb()
  const db = useDatabase()

  const channelRow = await db.prepare('SELECT * FROM chat_channels WHERE id = ?').get(channelId) as { type: string } | undefined
  if (!channelRow) {
    throw createError({ statusCode: 404, statusMessage: 'Channel not found' })
  }

  if (channelRow.type !== 'group') {
    throw createError({ statusCode: 400, statusMessage: 'Only group channels can be edited' })
  }

  if (!await isChannelMember(channelId, user.id)) {
    throw createError({ statusCode: 403, statusMessage: 'You are not a member of this channel' })
  }

  if (body.name?.trim())
    await db.prepare('UPDATE chat_channels SET name = ? WHERE id = ?').run(body.name.trim(), channelId)

  if (body.memberIds) {
    const memberIds = new Set([user.id, ...body.memberIds])
    const now = new Date().toISOString()

    await db.prepare('DELETE FROM chat_channel_members WHERE channel_id = ?').run(channelId)
    for (const memberId of memberIds)
      await db.prepare('INSERT INTO chat_channel_members (channel_id, staff_id, joined_at) VALUES (?, ?, ?)').run(channelId, memberId, now)
  }

  const channel = await loadChannelForUser(channelId, user.id)
  return { channel }
})
