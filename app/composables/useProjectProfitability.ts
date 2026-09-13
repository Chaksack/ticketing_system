import type { ProjectProfitabilityRow } from '~/types/project-profitability'

export function useProjectProfitability() {
  const rows = useState<ProjectProfitabilityRow[]>('project-profitability-rows', () => [])

  async function fetchProfitability(projectId?: string) {
    const { rows: result } = await $fetch<{ rows: ProjectProfitabilityRow[] }>('/api/reports/project-profitability', { query: projectId ? { projectId } : {} })
    rows.value = result
    return result
  }

  return { rows, fetchProfitability }
}
