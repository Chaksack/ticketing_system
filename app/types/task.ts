export type TaskType = 'epic' | 'task' | 'subtask'
export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done'
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
