import { del, put } from '@vercel/blob'

const MAX_SIZE = 2 * 1024 * 1024
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)

  const parts = await readMultipartFormData(event)
  const file = parts?.find(part => part.name === 'avatar' && part.filename)

  if (!file) {
    throw createError({ statusCode: 400, statusMessage: 'No image file was provided' })
  }

  if (!file.type || !ALLOWED_TYPES.includes(file.type)) {
    throw createError({ statusCode: 400, statusMessage: 'Please upload a PNG, JPEG, WEBP, or GIF image' })
  }

  if (file.data.length > MAX_SIZE) {
    throw createError({ statusCode: 400, statusMessage: 'Image must be smaller than 2MB' })
  }

  const ext = file.type.split('/')[1]
  const blob = await put(`avatars/${sessionUser.id}-${Date.now()}.${ext}`, file.data, {
    access: 'public',
    contentType: file.type,
  })

  await ensureDb()
  const db = useDatabase()
  await db.prepare('UPDATE staff SET avatar_url = ? WHERE id = ?').run(blob.url, sessionUser.id)

  const previousAvatarUrl = sessionUser.avatarUrl
  if (previousAvatarUrl) {
    await del(previousAvatarUrl).catch(() => {})
  }

  const updatedUser = { ...sessionUser, avatarUrl: blob.url }
  const session = await useAuthSession(event)
  await session.update({ user: updatedUser })

  return { user: updatedUser }
})
