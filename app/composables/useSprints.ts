import type { Sprint, SprintStatus } from '~/types/sprint'

export interface NewSprint {
  name: string
  goal?: string
  status?: SprintStatus
  startDate?: string
  endDate?: string
}

export interface SprintPatch {
  name?: string
  goal?: string | null
  status?: SprintStatus
  startDate?: string | null
  endDate?: string | null
}

export function useSprints() {
  const sprints = useState<Sprint[]>('sprints-list', () => [])

  async function fetchSprints() {
    const { sprints: rows } = await $fetch('/api/sprints')
    sprints.value = rows
  }

  function replaceSprint(sprint: Sprint) {
    const index = sprints.value.findIndex(s => s.id === sprint.id)
    if (index === -1)
      sprints.value.push(sprint)
    else
      sprints.value[index] = sprint
  }

  async function addSprint(payload: NewSprint) {
    const { sprint } = await $fetch('/api/sprints', { method: 'POST', body: payload })
    sprints.value.push(sprint)
    return sprint
  }

  async function updateSprint(id: string, patch: SprintPatch) {
    const { sprint } = await $fetch<{ sprint: Sprint }>(`/api/sprints/${id}`, { method: 'PATCH', body: patch })
    // A PATCH that starts this sprint may have auto-completed another one server-side —
    // refetch the full list so that demotion is reflected instead of only patching locally.
    if (patch.status === 'active')
      await fetchSprints()
    else
      replaceSprint(sprint)
    return sprint
  }

  async function removeSprint(id: string) {
    await $fetch<{ success: true }>(`/api/sprints/${id}`, { method: 'DELETE' })
    sprints.value = sprints.value.filter(s => s.id !== id)
  }

  const activeSprint = computed(() => sprints.value.find(s => s.status === 'active'))

  return { sprints, activeSprint, fetchSprints, addSprint, updateSprint, removeSprint }
}
