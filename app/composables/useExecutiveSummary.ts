import type { ExecutiveSummary } from '~/types/executive-summary'

export function useExecutiveSummary() {
  const summary = useState<ExecutiveSummary | null>('executive-summary', () => null)

  async function fetchSummary() {
    summary.value = await $fetch<ExecutiveSummary>('/api/reports/executive-summary')
  }

  return { summary, fetchSummary }
}
