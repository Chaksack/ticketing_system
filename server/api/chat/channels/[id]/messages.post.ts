import { put } from '@vercel/blob'

const MAX_SIZE = 4 * 1024 * 1024

// Vercel Node.js serverless functions cap request bodies around ~4.5MB, and this upload relays
// through the function (same pattern as server/api/auth/profile/avatar.post.ts) rather than
// going straight from the browser to Blob storage — so the cap stays safely under that ceiling.
const ALLOWED_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/zip': 'zip',
}

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const channelId = getRouterParam(event, 'id')

  if (!channelId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing channel id' })
  }

  const parts = await readMultipartFormData(event)
  const bodyPart = parts?.find(part => part.name === 'body')
  const attachmentPart = parts?.find(part => part.name === 'attachment' && part.filename)

  const body = bodyPart?.data.toString('utf-8').trim() ?? ''

  if (!body && !attachmentPart) {
    throw createError({ statusCode: 400, statusMessage: 'Message body or an attachment is required' })
  }

  if (attachmentPart) {
    if (!attachmentPart.type || !ALLOWED_TYPES[attachmentPart.type]) {
      throw createError({ statusCode: 400, statusMessage: 'That file type is not supported' })
    }

    if (attachmentPart.data.length > MAX_SIZE) {
      throw createError({ statusCode: 400, statusMessage: 'Attachment must be smaller than 4MB' })
    }
  }

  await ensureDb()

  if (!await isChannelMember(channelId, user.id)) {
    throw createError({ statusCode: 403, statusMessage: 'You are not a member of this channel' })
  }

  let attachmentUrl: string | null = null
  let attachmentName: string | null = null
  let attachmentType: string | null = null
  let attachmentSize: number | null = null

  if (attachmentPart) {
    const ext = ALLOWED_TYPES[attachmentPart.type!]
    const blob = await put(`chat-attachments/${channelId}/${user.id}-${Date.now()}.${ext}`, attachmentPart.data, {
      access: 'public',
      contentType: attachmentPart.type,
    })

    attachmentUrl = blob.url
    attachmentName = attachmentPart.filename ?? 'attachment'
    attachmentType = attachmentPart.type!
    attachmentSize = attachmentPart.data.length
  }

  const db = useDatabase()
  const id = await nextChatMessageId()
  const now = new Date().toISOString()

  await db.prepare(`
    INSERT INTO chat_messages (id, channel_id, author_id, body, created_at, attachment_url, attachment_name, attachment_type, attachment_size)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, channelId, user.id, body, now, attachmentUrl, attachmentName, attachmentType, attachmentSize)
  await db.prepare('UPDATE chat_channel_members SET last_read_at = ? WHERE channel_id = ? AND staff_id = ?').run(now, channelId, user.id)

  const notifBody = body || `📎 ${attachmentName}`

  const members = await getChannelMembers(channelId)
  for (const member of members) {
    if (member.id === user.id)
      continue

    await createNotification({
      staffId: member.id,
      type: 'chat_message',
      title: user.name,
      body: notifBody.slice(0, 140),
      url: `/chat?channel=${channelId}`,
    })
    await sendPushToStaff(member.id, {
      title: user.name,
      body: notifBody.slice(0, 140),
      url: `/chat?channel=${channelId}`,
    })
  }

  return {
    message: mapChatMessageRow({
      id,
      channel_id: channelId,
      author_id: user.id,
      author_name: user.name,
      body,
      created_at: now,
      edited_at: null,
      attachment_url: attachmentUrl,
      attachment_name: attachmentName,
      attachment_type: attachmentType,
      attachment_size: attachmentSize,
    }),
  }
})
