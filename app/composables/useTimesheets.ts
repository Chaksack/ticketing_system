import type { TimesheetEntry } from '~/types/timesheet'

export interface TimesheetFilter {
  staffId?: string
  projectId?: string
  taskId?: string
  from?: string
  to?: string
}

export interface NewTimesheet {
  taskId: string
  workDate: string
  hours: number
  billable?: boolean
  notes?: string
}

export function useTimesheets() {
  const entries = useState<TimesheetEntry[]>('timesheets-list', () => [])

  async function fetchTimesheets(filter: TimesheetFilter = {}) {
    const { entries: rows } = await $fetch<{ entries: TimesheetEntry[] }>('/api/timesheets', { query: filter })
    entries.value = rows
  }

  async function addTimesheet(payload: NewTimesheet) {
    const { entry } = await $fetch<{ entry: TimesheetEntry }>('/api/timesheets', { method: 'POST', body: payload })
    entries.value.unshift(entry)
    return entry
  }

  async function updateTimesheet(id: string, patch: { workDate?: string, hours?: number, billable?: boolean, notes?: string | null }) {
    const { entry } = await $fetch<{ entry: TimesheetEntry }>(`/api/timesheets/${id}`, { method: 'PATCH', body: patch })
    const index = entries.value.findIndex(e => e.id === id)
    if (index !== -1)
      entries.value[index] = entry
    return entry
  }

  async function removeTimesheet(id: string) {
    await $fetch(`/api/timesheets/${id}`, { method: 'DELETE' })
    entries.value = entries.value.filter(e => e.id !== id)
  }

  return { entries, fetchTimesheets, addTimesheet, updateTimesheet, removeTimesheet }
}
