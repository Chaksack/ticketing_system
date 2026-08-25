export interface TaskStatusColumn {
  id: string
  label: string
  position: number
}

export function useTaskStatuses() {
  const statuses = useState<TaskStatusColumn[]>('task-statuses-list', () => [])

  async function fetchStatuses() {
    const { statuses: rows } = await $fetch('/api/task-statuses')
    statuses.value = rows
  }

  async function addStatus(label: string) {
    const { status } = await $fetch('/api/task-statuses', { method: 'POST', body: { label } })
    statuses.value.push(status)
    return status
  }

  async function renameStatus(id: string, label: string) {
    const { status } = await $fetch<{ status: TaskStatusColumn }>(`/api/task-statuses/${id}`, { method: 'PATCH', body: { label } })
    const index = statuses.value.findIndex(s => s.id === id)
    if (index !== -1)
      statuses.value[index] = status
    return status
  }

  async function removeStatus(id: string) {
    await $fetch<{ success: true }>(`/api/task-statuses/${id}`, { method: 'DELETE' })
    statuses.value = statuses.value.filter(s => s.id !== id)
  }

  async function reorderStatuses(ids: string[]) {
    const { statuses: rows } = await $fetch<{ statuses: TaskStatusColumn[] }>('/api/task-statuses/reorder', { method: 'POST', body: { ids } })
    statuses.value = rows
  }

  return { statuses, fetchStatuses, addStatus, renameStatus, removeStatus, reorderStatuses }
}
