interface NewChannelBody {
  type?: 'direct' | 'group'
  staffId?: string
  name?: string
  memberIds?: string[]
}

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const body = await readBody<NewChannelBody>(event)

  await ensureDb()
  const db = useDatabase()
  const now = new Date().toISOString()

  if (body.type === 'direct') {
    if (!body.staffId || body.staffId === user.id) {
      throw createError({ statusCode: 400, statusMessage: 'staffId is required and must not be yourself' })
    }

    const existing = await db.prepare(`
      SELECT chat_channels.id
      FROM chat_channels
      WHERE chat_channels.type = 'direct'
        AND chat_channels.id IN (SELECT channel_id FROM chat_channel_members WHERE staff_id = ?)
        AND chat_channels.id IN (SELECT channel_id FROM chat_channel_members WHERE staff_id = ?)
    `).get(user.id, body.staffId) as { id: string } | undefined

    if (existing) {
      const channel = await loadChannelForUser(existing.id, user.id)
      return { channel }
    }

    const id = await nextChannelId()
    await db.prepare('INSERT INTO chat_channels (id, type, name, created_by, created_at) VALUES (?, \'direct\', NULL, ?, ?)').run(id, user.id, now)
    await db.prepare('INSERT INTO chat_channel_members (channel_id, staff_id, joined_at) VALUES (?, ?, ?)').run(id, user.id, now)
    await db.prepare('INSERT INTO chat_channel_members (channel_id, staff_id, joined_at) VALUES (?, ?, ?)').run(id, body.staffId, now)

    const channel = await loadChannelForUser(id, user.id)
    return { channel }
  }

  if (!body.name?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'A group name is required' })
  }

  const id = await nextChannelId()
  await db.prepare('INSERT INTO chat_channels (id, type, name, created_by, created_at) VALUES (?, \'group\', ?, ?, ?)').run(id, body.name.trim(), user.id, now)

  const memberIds = new Set([user.id, ...(body.memberIds ?? [])])
  for (const memberId of memberIds)
    await db.prepare('INSERT INTO chat_channel_members (channel_id, staff_id, joined_at) VALUES (?, ?, ?)').run(id, memberId, now)

  const channel = await loadChannelForUser(id, user.id)
  return { channel }
})
