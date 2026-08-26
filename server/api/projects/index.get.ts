import type { ContractRow, ProjectRow } from '../../utils/mappers'

export default defineEventHandler(async (event) => {
  await requireBd(event)
  await ensureDb()

  const db = useDatabase()
  const rows = await db.prepare(`
    SELECT projects.*, clients.name AS client_name
    FROM projects
    LEFT JOIN clients ON clients.id = projects.client_id
    ORDER BY projects.created_at DESC
  `).all() as ProjectRow[]

  const contractRows = await db.prepare(`
    SELECT client_amc_contracts.*, amc_plans.name AS plan_name
    FROM client_amc_contracts
    LEFT JOIN amc_plans ON amc_plans.id = client_amc_contracts.plan_id
    WHERE client_amc_contracts.project_id IS NOT NULL
  `).all() as ContractRow[]

  const contractsByProject = new Map<string, ContractRow[]>()
  for (const contractRow of contractRows) {
    const list = contractsByProject.get(contractRow.project_id!) ?? []
    list.push(contractRow)
    contractsByProject.set(contractRow.project_id!, list)
  }

  return {
    projects: rows.map(row => mapProjectRow(row, (contractsByProject.get(row.id) ?? []).map(contractRow => mapContractRow(contractRow)))),
  }
})
