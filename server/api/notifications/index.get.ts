import type { NotificationType } from '../../../app/types/notification'

interface NotificationRow {
  id: string
  staff_id: string
  type: string
  title: string
  body: string
  url: string | null
  ticket_id: string | null
  task_id: string | null
  lead_id: string | null
  contract_id: string | null
  read: number
  created_at: string
}

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)

  await ensureDb()
  const db = useDatabase()

  const rows = await db.prepare(`
    SELECT * FROM notifications WHERE staff_id = ? ORDER BY created_at DESC LIMIT 30
  `).all(user.id) as NotificationRow[]

  return {
    notifications: rows.map(row => ({
      id: row.id,
      type: row.type as NotificationType,
      title: row.title,
      body: row.body,
      url: row.url ?? undefined,
      ticketId: row.ticket_id ?? undefined,
      taskId: row.task_id ?? undefined,
      leadId: row.lead_id ?? undefined,
      contractId: row.contract_id ?? undefined,
      read: !!row.read,
      createdAt: row.created_at,
    })),
  }
})
