import type { Assignee } from './assignee'

export interface CalendarEvent {
  id: string
  title: string
  description?: string
  location?: string
  startAt: string
  endAt: string
  attendees: Assignee[]
  createdBy?: string
  createdByName?: string
  reminderSent: boolean
  createdAt: string
  updatedAt: string
}
