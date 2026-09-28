import type { Project } from '../../app/types/project'
import type { ContractRow, ProjectFinancialEntryRow, ProjectRow } from './mappers'

/** Cost/payment totals for each project row — add to any `SELECT projects.* ...` so mapProjectRow can compute margin and amount due. */
export const PROJECT_TOTALS_COLUMNS = `
  (SELECT COALESCE(SUM(amount), 0) FROM project_financial_entries WHERE project_id = projects.id AND kind = 'cost') AS cost_total,
  (SELECT COALESCE(SUM(amount), 0) FROM project_financial_entries WHERE project_id = projects.id AND kind = 'payment') AS paid_total
`

const PROJECT_SELECT = `
  SELECT projects.*, clients.name AS client_name, ${PROJECT_TOTALS_COLUMNS}
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
    SELECT client_amc_contracts.*, amc_plans.name AS plan_name, amc_plans.price AS plan_price
    FROM client_amc_contracts
    LEFT JOIN amc_plans ON amc_plans.id = client_amc_contracts.plan_id
    WHERE client_amc_contracts.project_id = ?
    ORDER BY client_amc_contracts.start_date DESC
  `).all(id) as ContractRow[]

  const contracts = []
  for (const contractRow of contractRows) {
    const lineItems = await getContractLineItems(contractRow.id)
    contracts.push(mapContractRow(contractRow, lineItems))
  }

  const taskCountRow = await db.prepare('SELECT COUNT(*) AS count FROM tasks WHERE project_id = ?').get(id) as { count: string | number }

  const entryRows = await db.prepare(`
    SELECT project_financial_entries.*, staff.name AS recorded_by_name
    FROM project_financial_entries
    LEFT JOIN staff ON staff.id = project_financial_entries.recorded_by
    WHERE project_financial_entries.project_id = ?
    ORDER BY project_financial_entries.entry_date DESC, project_financial_entries.created_at DESC
  `).all(id) as ProjectFinancialEntryRow[]

  return mapProjectRow(row, contracts, Number(taskCountRow.count), entryRows.map(mapProjectFinancialEntryRow))
}

/**
 * Removes a project and what only makes sense with it (AMC contract link, costs/payments). Tasks,
 * timesheets and the project's chat channel are staff work history — they're kept and detached
 * rather than deleted.
 */
export async function deleteProjectCascade(id: string) {
  const db = useDatabase()
  // Keep the AMC contract history — just detach it from the project being removed, mirroring
  // how deleting a task epic nulls epic_id on its tasks rather than deleting them.
  await db.prepare('UPDATE client_amc_contracts SET project_id = NULL WHERE project_id = ?').run(id)
  await db.prepare('UPDATE tasks SET project_id = NULL WHERE project_id = ?').run(id)
  await db.prepare('UPDATE chat_channels SET project_id = NULL WHERE project_id = ?').run(id)
  await db.prepare('DELETE FROM project_financial_entries WHERE project_id = ?').run(id)
  await db.prepare('DELETE FROM projects WHERE id = ?').run(id)
}
