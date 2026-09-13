import type { Budget, BudgetVsActualRow } from '~/types/budget'

export interface NewBudget {
  periodId: string
  accountCode: string
  amount: number
  notes?: string
}

export function useBudgets() {
  const budgets = useState<Budget[]>('budgets-list', () => [])
  const budgetVsActual = useState<BudgetVsActualRow[]>('budget-vs-actual', () => [])

  async function fetchBudgets(periodId?: string) {
    const { budgets: rows } = await $fetch<{ budgets: Budget[] }>('/api/budgets', { query: periodId ? { periodId } : {} })
    budgets.value = rows
  }

  async function addBudget(payload: NewBudget) {
    const { budget } = await $fetch<{ budget: Budget }>('/api/budgets', { method: 'POST', body: payload })
    budgets.value.push(budget)
    return budget
  }

  async function updateBudget(id: string, patch: { amount?: number, notes?: string | null }) {
    const { budget } = await $fetch<{ budget: Budget }>(`/api/budgets/${id}`, { method: 'PATCH', body: patch })
    const index = budgets.value.findIndex(b => b.id === id)
    if (index !== -1)
      budgets.value[index] = budget
    return budget
  }

  async function removeBudget(id: string) {
    await $fetch(`/api/budgets/${id}`, { method: 'DELETE' })
    budgets.value = budgets.value.filter(b => b.id !== id)
  }

  async function fetchBudgetVsActual(periodId: string) {
    const { rows } = await $fetch<{ periodId: string, rows: BudgetVsActualRow[] }>('/api/reports/budget-vs-actual', { query: { periodId } })
    budgetVsActual.value = rows
  }

  return { budgets, budgetVsActual, fetchBudgets, addBudget, updateBudget, removeBudget, fetchBudgetVsActual }
}
