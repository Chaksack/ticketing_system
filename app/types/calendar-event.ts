import type { Assignee } from './assignee'
import type { RegardingType } from './interaction'

export interface CalendarEvent {
  id: string
  title: string
  description?: string
  location?: string
  activityType?: string
  startAt: string
  endAt: string
  attendees: Assignee[]
  regardingType?: RegardingType
  regardingId?: string
  regardingLabel?: string
  createdBy?: string
  createdByName?: string
  reminderSent: boolean
  createdAt: string
  updatedAt: string
}
