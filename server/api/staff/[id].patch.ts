import type { StaffRole, StaffStatus } from '../../../app/types/staff'
import type { StaffRow } from '../../utils/mappers'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = getRouterParam(event, 'id')
  const body = await readBody<{ status?: StaffStatus, onCall?: boolean, roles?: StaffRole[] }>(event)

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing staff id' })
  }

  await ensureDb()
  const db = useDatabase()

  const existing = await db.prepare('SELECT * FROM staff WHERE id = ?').get(id) as StaffRow | undefined
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Staff member not found' })
  }

  if (body.roles?.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'A staff member needs at least one role' })
  }

  const status = body.status ?? existing.status
  const onCall = body.onCall === undefined ? existing.on_call : Number(body.onCall)
  const roles = body.roles ?? parseStaffRoles(existing)

  await db.prepare('UPDATE staff SET status = ?, on_call = ?, role = ?, roles = ? WHERE id = ?')
    .run(status, onCall, roles[0], JSON.stringify(roles), id)

  if (body.onCall === true && !existing.on_call) {
    const title = 'You\'re on call'
    const notificationBody = 'You\'ll be paged for new tickets until your on-call status changes.'

    await createNotification({
      staffId: id,
      type: 'on_call_assigned',
      title,
      body: notificationBody,
      url: '/admin',
    })

    await sendPushToStaff(id, {
      title,
      body: notificationBody,
      url: '/admin',
    })
  }

  const row = await db.prepare('SELECT * FROM staff WHERE id = ?').get(id) as StaffRow
  return { staff: mapStaffRow(row) }
})
