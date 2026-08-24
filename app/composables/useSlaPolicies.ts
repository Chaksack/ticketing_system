import type { SlaPolicy } from '~/types/automation'

export function useSlaPolicies() {
  const policies = useState<SlaPolicy[]>('sla-policies-list', () => [])

  async function fetchPolicies() {
    const { policies: rows } = await $fetch('/api/sla-policies')
    policies.value = rows
  }

  async function updatePolicy(priority: SlaPolicy['priority'], payload: { firstResponseMins?: number, resolutionMins?: number }) {
    const { policy } = await $fetch(`/api/sla-policies/${priority}`, { method: 'PATCH', body: payload })
    const index = policies.value.findIndex(p => p.priority === priority)
    if (index !== -1)
      policies.value[index] = policy
    return policy
  }

  return { policies, fetchPolicies, updatePolicy }
}
