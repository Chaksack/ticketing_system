import type { StaffRow } from '../../utils/mappers'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  await ensureDb()

  const db = useDatabase()
  const rows = await db.prepare('SELECT * FROM staff ORDER BY created_at DESC').all() as StaffRow[]

  return { staff: rows.map(mapStaffRow) }
})
