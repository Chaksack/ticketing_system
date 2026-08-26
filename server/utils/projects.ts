import type { Project } from '../../app/types/project'
import type { ContractRow, ProjectRow } from './mappers'

const PROJECT_SELECT = `
  SELECT projects.*, clients.name AS client_name
  FROM projects
  LEFT JOIN clients ON clients.id = projects.client_id
  WHERE projects.id = ?
`

export async function loadFullProject(id: string): Promise<Project> {
  const db = useDatabase()

  const row = await db.prepare(PROJECT_SELECT).get(id) as ProjectRow | undefined
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Project not found' })
  }

  const contractRows = await db.prepare(`
    SELECT client_amc_contracts.*, amc_plans.name AS plan_name
    FROM client_amc_contracts
    LEFT JOIN amc_plans ON amc_plans.id = client_amc_contracts.plan_id
    WHERE client_amc_contracts.project_id = ?
    ORDER BY client_amc_contracts.start_date DESC
  `).all(id) as ContractRow[]

  return mapProjectRow(row, contractRows.map(contractRow => mapContractRow(contractRow)))
}
