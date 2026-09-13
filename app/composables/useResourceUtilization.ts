import type { ResourceUtilizationRow } from '~/types/resource-utilization'

export function useResourceUtilization() {
  const rows = useState<ResourceUtilizationRow[]>('resource-utilization-rows', () => [])
  const from = useState<string>('resource-utilization-from', () => '')
  const to = useState<string>('resource-utilization-to', () => '')

  async function fetchUtilization(range?: { from?: string, to?: string }) {
    const result = await $fetch<{ from: string, to: string, rows: ResourceUtilizationRow[] }>('/api/reports/resource-utilization', { query: range ?? {} })
    rows.value = result.rows
    from.value = result.from
    to.value = result.to
  }

  return { rows, from, to, fetchUtilization }
}
