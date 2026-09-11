import type { BdQuota, BdQuotaProgress } from '~/types/quota'

export function useBdQuotas() {
  const quotas = useState<BdQuota[]>('bd-quotas-list', () => [])
  const progress = useState<BdQuotaProgress[]>('bd-quotas-progress', () => [])

  async function fetchQuotas(period: string) {
    const { quotas: rows } = await $fetch<{ quotas: BdQuota[] }>('/api/bd-quotas', { query: { period } })
    quotas.value = rows
  }

  async function upsertQuota(payload: { staffId: string, period: string, targetValue: number }) {
    const { quota } = await $fetch<{ quota: BdQuota }>('/api/bd-quotas', { method: 'POST', body: payload })
    const index = quotas.value.findIndex(q => q.staffId === quota.staffId && q.period === quota.period)
    if (index === -1)
      quotas.value.push(quota)
    else
      quotas.value[index] = quota
    return quota
  }

  async function removeQuota(id: string) {
    await $fetch(`/api/bd-quotas/${id}`, { method: 'DELETE' })
    quotas.value = quotas.value.filter(q => q.id !== id)
  }

  async function fetchProgress(period: string) {
    const { progress: rows } = await $fetch<{ progress: BdQuotaProgress[] }>('/api/bd-quotas/progress', { query: { period } })
    progress.value = rows
  }

  return { quotas, progress, fetchQuotas, upsertQuota, removeQuota, fetchProgress }
}
