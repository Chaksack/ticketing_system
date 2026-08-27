import type { CalendarEvent } from '~/types/calendar-event'

export interface CalendarEventPayload {
  title: string
  description?: string
  location?: string
  startAt: string
  endAt: string
  attendeeIds?: string[]
}

export function useCalendar() {
  const events = useState<CalendarEvent[]>('calendar-events', () => [])

  function replaceEvent(event: CalendarEvent) {
    const index = events.value.findIndex(e => e.id === event.id)
    if (index === -1)
      events.value.push(event)
    else
      events.value[index] = event
  }

  async function fetchEvents(range: { from: string, to: string }) {
    const { events: rows } = await $fetch<{ events: CalendarEvent[] }>('/api/calendar/events', { query: range })
    events.value = rows
  }

  async function addEvent(payload: CalendarEventPayload) {
    const { event } = await $fetch<{ event: CalendarEvent }>('/api/calendar/events', { method: 'POST', body: payload })
    replaceEvent(event)
    return event
  }

  async function updateEvent(id: string, patch: Partial<CalendarEventPayload>) {
    const { event } = await $fetch<{ event: CalendarEvent }>(`/api/calendar/events/${id}`, { method: 'PATCH', body: patch })
    replaceEvent(event)
    return event
  }

  async function removeEvent(id: string) {
    await $fetch(`/api/calendar/events/${id}`, { method: 'DELETE' })
    events.value = events.value.filter(e => e.id !== id)
  }

  return { events, fetchEvents, addEvent, updateEvent, removeEvent }
}
