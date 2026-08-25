import type { StaffRow } from '../../utils/mappers'

export default defineEventHandler(async (event) => {
  // Any logged-in staff member can list staff (needed to populate assignee pickers on
  // tickets and clients) — write operations below stay admin-only.
  await requireSessionUser(event)
  await ensureDb()

  const db = useDatabase()
  const rows = await db.prepare('SELECT * FROM staff ORDER BY created_at DESC').all() as StaffRow[]

  return { staff: rows.map(mapStaffRow) }
})
