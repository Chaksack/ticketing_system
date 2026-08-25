import type { AppNotification } from '~/types/notification'

export function useNotifications() {
  const notifications = useState<AppNotification[]>('app-notifications', () => [])

  async function fetchNotifications() {
    const { notifications: rows } = await $fetch('/api/notifications')
    notifications.value = rows
  }

  async function markRead(id: string) {
    await $fetch(`/api/notifications/${id}/read`, { method: 'POST' })
    const notification = notifications.value.find(n => n.id === id)
    if (notification)
      notification.read = true
    useAlarm().stop()
  }

  async function markAllRead() {
    const unread = notifications.value.filter(n => !n.read)
    if (!unread.length)
      return

    await $fetch('/api/notifications/mark-all-read', { method: 'POST' })
    unread.forEach(n => n.read = true)
    useAlarm().stop()
  }

  return { notifications, fetchNotifications, markRead, markAllRead }
}
