interface NewMessageBody {
  body?: string
}

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const channelId = getRouterParam(event, 'id')
  const body = await readBody<NewMessageBody>(event)

  if (!channelId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing channel id' })
  }

  if (!body?.body?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Message body is required' })
  }

  await ensureDb()

  if (!await isChannelMember(channelId, user.id)) {
    throw createError({ statusCode: 403, statusMessage: 'You are not a member of this channel' })
  }

  const db = useDatabase()
  const id = await nextChatMessageId()
  const now = new Date().toISOString()

  await db.prepare('INSERT INTO chat_messages (id, channel_id, author_id, body, created_at) VALUES (?, ?, ?, ?, ?)').run(id, channelId, user.id, body.body.trim(), now)
  await db.prepare('UPDATE chat_channel_members SET last_read_at = ? WHERE channel_id = ? AND staff_id = ?').run(now, channelId, user.id)

  const members = await getChannelMembers(channelId)
  for (const member of members) {
    if (member.id === user.id)
      continue

    await createNotification({
      staffId: member.id,
      type: 'chat_message',
      title: user.name,
      body: body.body.trim().slice(0, 140),
      url: `/chat?channel=${channelId}`,
    })
    await sendPushToStaff(member.id, {
      title: user.name,
      body: body.body.trim().slice(0, 140),
      url: `/chat?channel=${channelId}`,
    })
  }

  return {
    message: mapChatMessageRow({
      id,
      channel_id: channelId,
      author_id: user.id,
      author_name: user.name,
      body: body.body.trim(),
      created_at: now,
      edited_at: null,
    }),
  }
})
