import type { NotificationType } from '../../app/types/notification'

export interface NewNotification {
  staffId: string
  type: NotificationType
  title: string
  body: string
  url?: string
  ticketId?: string
  taskId?: string
  leadId?: string
}

export async function createNotification(input: NewNotification) {
  await ensureDb()
  const db = useDatabase()

  const id = await nextNotificationId()
  const now = new Date().toISOString()

  await db.prepare(`
    INSERT INTO notifications (id, staff_id, type, title, body, url, ticket_id, task_id, lead_id, read, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
  `).run(id, input.staffId, input.type, input.title, input.body, input.url ?? null, input.ticketId ?? null, input.taskId ?? null, input.leadId ?? null, now)

  return id
}

const READ_RETENTION_MS = 30 * 60 * 1000

export async function pruneReadNotifications() {
  await ensureDb()
  const db = useDatabase()

  const cutoff = new Date(Date.now() - READ_RETENTION_MS).toISOString()
  const due = await db.prepare('SELECT id FROM notifications WHERE read = 1 AND read_at IS NOT NULL AND read_at <= ?').all(cutoff) as { id: string }[]

  await db.prepare('DELETE FROM notifications WHERE read = 1 AND read_at IS NOT NULL AND read_at <= ?').run(cutoff)

  return { pruned: due.length }
}
