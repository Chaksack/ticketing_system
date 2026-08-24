import type { TagRow } from '../../utils/mappers'

export default defineEventHandler(async (event) => {
  await requireSessionUser(event)

  const body = await readBody<{ name?: string, color?: string }>(event)

  if (!body?.name?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'name is required' })
  }

  await ensureDb()
  const db = useDatabase()

  const name = body.name.trim()
  const existing = await db.prepare('SELECT * FROM tags WHERE name = ?').get(name) as TagRow | undefined
  if (existing) {
    setResponseStatus(event, 200)
    return { tag: mapTagRow(existing) }
  }

  const id = await nextTagId()
  const now = new Date().toISOString()
  const color = body.color ?? 'gray'

  await db.prepare('INSERT INTO tags (id, name, color, created_at) VALUES (?, ?, ?, ?)').run(id, name, color, now)

  setResponseStatus(event, 201)
  return { tag: { id, name, color } }
})
