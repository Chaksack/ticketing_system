export type NotificationType = 'ticket_page' | 'on_call_assigned' | 'internal_note' | 'reply' | 'task_reminder' | 'task_assigned'

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  body: string
  url?: string
  ticketId?: string
  taskId?: string
  read: boolean
  createdAt: string
}
