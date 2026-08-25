export type TaskType = 'epic' | 'task' | 'subtask'
// Staff-defined board columns (see `task_statuses` table / useTaskStatuses) — not a fixed enum.
export type TaskStatus = string
export type TaskPriority = 'low' | 'medium' | 'high'

export interface Task {
  id: string
  type: TaskType
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  color?: string
  assigneeId?: string
  assigneeName?: string
  epicId?: string
  epicTitle?: string
  epicColor?: string
  parentTaskId?: string
  startDate?: string
  dueDate?: string
  remindAt?: string
  reminderSent: boolean
  createdBy?: string
  createdAt: string
  updatedAt: string
}
