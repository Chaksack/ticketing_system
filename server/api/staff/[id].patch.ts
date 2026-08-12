import type { StaffRole, StaffStatus } from '../../../app/types/staff'
import type { StaffRow } from '../../utils/mappers'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = getRouterParam(event, 'id')
  const body = await readBody<{ status?: StaffStatus, onCall?: boolean, role?: StaffRole }>(event)

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing staff id' })
  }

  await ensureDb()
  const db = useDatabase()

  const existing = await db.prepare('SELECT * FROM staff WHERE id = ?').get(id) as StaffRow | undefined
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Staff member not found' })
  }

  const status = body.status ?? existing.status
  const onCall = body.onCall === undefined ? existing.on_call : (body.onCall ? 1 : 0)
  const role = body.role ?? existing.role

  await db.prepare('UPDATE staff SET status = ?, on_call = ?, role = ? WHERE id = ?').run(status, onCall, role, id)

  const row = await db.prepare('SELECT * FROM staff WHERE id = ?').get(id) as StaffRow
  return { staff: mapStaffRow(row) }
})
