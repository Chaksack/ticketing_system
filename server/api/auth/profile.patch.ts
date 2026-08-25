import type { StaffRow } from '../../utils/mappers'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)

  const body = await readBody<{ name?: string }>(event)
  const name = body?.name?.trim()

  if (!name || name.length < 2) {
    throw createError({ statusCode: 400, statusMessage: 'Name must be at least 2 characters' })
  }

  await ensureDb()
  const db = useDatabase()

  await db.prepare('UPDATE staff SET name = ? WHERE id = ?').run(name, sessionUser.id)

  const row = await db.prepare('SELECT * FROM staff WHERE id = ?').get(sessionUser.id) as StaffRow

  const session = await useAuthSession(event)
  const updatedUser = { ...sessionUser, name: row.name }
  await session.update({ user: updatedUser })

  return { user: updatedUser }
})
