import type { Task, TaskPriority, TaskStatus, TaskType } from '~/types/task'

export interface NewTask {
  type?: TaskType
  title: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  color?: string
  assigneeId?: string
  epicId?: string
  parentTaskId?: string
  startDate?: string
  dueDate?: string
  remindAt?: string
}

export interface TaskPatch {
  title?: string
  description?: string | null
  status?: TaskStatus
  priority?: TaskPriority
  color?: string | null
  assigneeId?: string | null
  epicId?: string | null
  parentTaskId?: string | null
  startDate?: string | null
  dueDate?: string | null
  remindAt?: string | null
}

export function useTasks() {
  const tasks = useState<Task[]>('tasks-list', () => [])

  async function fetchTasks() {
    const { tasks: rows } = await $fetch('/api/tasks')
    tasks.value = rows
  }

  function replaceTask(task: Task) {
    const index = tasks.value.findIndex(t => t.id === task.id)
    if (index === -1)
      tasks.value.unshift(task)
    else
      tasks.value[index] = task
  }

  async function addTask(payload: NewTask) {
    const { task } = await $fetch('/api/tasks', { method: 'POST', body: payload })
    tasks.value.unshift(task)
    return task
  }

  async function updateTask(id: string, patch: TaskPatch) {
    const { task } = await $fetch<{ task: Task }>(`/api/tasks/${id}`, { method: 'PATCH', body: patch })
    replaceTask(task)
    return task
  }

  async function removeTask(id: string) {
    await $fetch<{ success: true }>(`/api/tasks/${id}`, { method: 'DELETE' })
    tasks.value = tasks.value.filter(t => t.id !== id && t.parentTaskId !== id)
  }

  const epics = computed(() => tasks.value.filter(t => t.type === 'epic'))

  function subtasksOf(taskId: string) {
    return tasks.value.filter(t => t.type === 'subtask' && t.parentTaskId === taskId)
  }

  return { tasks, epics, fetchTasks, addTask, updateTask, removeTask, subtasksOf }
}
