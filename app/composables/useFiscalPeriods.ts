import type { FiscalPeriod, FiscalPeriodStatus } from '~/types/fiscal-period'

export function useFiscalPeriods() {
  const periods = useState<FiscalPeriod[]>('fiscal-periods-list', () => [])

  async function fetchPeriods() {
    const { periods: rows } = await $fetch('/api/fiscal-periods')
    periods.value = rows
  }

  async function addPeriod(payload: { startDate: string, endDate: string, label?: string }) {
    const { period } = await $fetch('/api/fiscal-periods', { method: 'POST', body: payload })
    periods.value.unshift(period)
    return period
  }

  async function setPeriodStatus(id: string, status: FiscalPeriodStatus) {
    const { period } = await $fetch<{ period: FiscalPeriod }>(`/api/fiscal-periods/${id}`, { method: 'PATCH', body: { status } })
    const index = periods.value.findIndex(p => p.id === id)
    if (index !== -1)
      periods.value[index] = period
    return period
  }

  return { periods, fetchPeriods, addPeriod, setPeriodStatus }
}
