import type { Task } from '../types/task'

export type TaskDueStatus = 'on-track' | 'due-soon' | 'overdue'

const DUE_SOON_WINDOW_MS = 24 * 60 * 60 * 1000

export function getTaskDueStatus(task: Pick<Task, 'dueDate' | 'status'>): TaskDueStatus | undefined {
  if (!task.dueDate || task.status === 'done')
    return undefined

  const now = Date.now()
  const due = new Date(task.dueDate).getTime()

  if (now > due)
    return 'overdue'

  if (due - now <= DUE_SOON_WINDOW_MS)
    return 'due-soon'

  return 'on-track'
}
