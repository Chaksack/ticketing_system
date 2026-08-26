import { del } from '@vercel/blob'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)

  await ensureDb()
  const db = useDatabase()
  await db.prepare('UPDATE staff SET avatar_url = NULL WHERE id = ?').run(sessionUser.id)

  if (sessionUser.avatarUrl) {
    await del(sessionUser.avatarUrl).catch(() => {})
  }

  const updatedUser = { ...sessionUser, avatarUrl: undefined }
  const session = await useAuthSession(event)
  await session.update({ user: updatedUser })

  return { user: updatedUser }
})
