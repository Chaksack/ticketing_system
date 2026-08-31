import type { SprintRow } from '../../utils/mappers'

export default defineEventHandler(async (event) => {
  await requireBd(event)
  await ensureDb()

  const db = useDatabase()
  const rows = await db.prepare('SELECT * FROM sprints ORDER BY created_at ASC').all() as SprintRow[]

  return { sprints: rows.map(mapSprintRow) }
})
