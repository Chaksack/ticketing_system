import type { BdReportSummary } from '~/types/bd-report'

export function useBdReports() {
  const summary = useState<BdReportSummary | null>('bd-report-summary', () => null)
  const isLoading = useState('bd-report-loading', () => false)

  async function fetchSummary(range?: { from: string, to: string }) {
    isLoading.value = true
    try {
      summary.value = await $fetch<BdReportSummary>('/api/bd-reports/summary', {
        query: range,
      })
    }
    finally {
      isLoading.value = false
    }
  }

  return { summary, isLoading, fetchSummary }
}
