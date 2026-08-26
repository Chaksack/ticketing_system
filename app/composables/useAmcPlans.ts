import type { AmcPlan } from '~/types/amc'

export interface NewAmcPlan {
  name: string
  description?: string
  defaultDurationMonths?: number
  price?: number
  currency?: string
}

export function useAmcPlans() {
  const plans = useState<AmcPlan[]>('amc-plans-list', () => [])

  async function fetchPlans() {
    const { plans: rows } = await $fetch('/api/amc-plans')
    plans.value = rows
  }

  async function addPlan(payload: NewAmcPlan) {
    const { plan } = await $fetch('/api/amc-plans', { method: 'POST', body: payload })
    plans.value.unshift(plan)
    return plan
  }

  async function updatePlan(id: string, payload: Partial<NewAmcPlan>) {
    const { plan } = await $fetch(`/api/amc-plans/${id}`, { method: 'PATCH', body: payload })
    const index = plans.value.findIndex(p => p.id === id)
    if (index !== -1)
      plans.value[index] = plan
    return plan
  }

  async function removePlan(id: string) {
    await $fetch(`/api/amc-plans/${id}`, { method: 'DELETE' })
    plans.value = plans.value.filter(p => p.id !== id)
  }

  return { plans, fetchPlans, addPlan, updatePlan, removePlan }
}
