import type { NotificationType } from '../../app/types/notification'

export interface NewNotification {
  staffId: string
  type: NotificationType
  title: string
  body: string
  url?: string
  ticketId?: string
  taskId?: string
}

export async function createNotification(input: NewNotification) {
  await ensureDb()
  const db = useDatabase()

  const id = await nextNotificationId()
  const now = new Date().toISOString()

  await db.prepare(`
    INSERT INTO notifications (id, staff_id, type, title, body, url, ticket_id, task_id, read, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
  `).run(id, input.staffId, input.type, input.title, input.body, input.url ?? null, input.ticketId ?? null, input.taskId ?? null, now)

  return id
}
