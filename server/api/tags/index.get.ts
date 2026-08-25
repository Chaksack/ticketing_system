import type { TagRow } from '../../utils/mappers'

export default defineEventHandler(async (event) => {
  await requireSessionUser(event)
  await ensureDb()

  const db = useDatabase()
  const rows = await db.prepare('SELECT * FROM tags ORDER BY name ASC').all() as TagRow[]

  return { tags: rows.map(row => mapTagRow(row)) }
})
