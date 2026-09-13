import type { ProjectProfitabilityRow } from '../../app/types/project-profitability'
import type { ResourceUtilizationRow, UtilizationStatus } from '../../app/types/resource-utilization'
import type { TimesheetEntry } from '../../app/types/timesheet'

export interface TimesheetRow {
  id: string
  staff_id: string
  staff_name?: string | null
  task_id: string
  task_title?: string | null
  project_id?: string | null
  project_name?: string | null
  work_date: string
  hours: number | string
  hourly_rate: number | string
  billable: number
  notes: string | null
  created_at: string
  updated_at: string
}

export function mapTimesheetRow(row: TimesheetRow): TimesheetEntry {
  return {
    id: row.id,
    staffId: row.staff_id,
    staffName: row.staff_name ?? undefined,
    taskId: row.task_id,
    taskTitle: row.task_title ?? undefined,
    projectId: row.project_id ?? undefined,
    projectName: row.project_name ?? undefined,
    workDate: row.work_date,
    hours: Number(row.hours),
    hourlyRate: Number(row.hourly_rate),
    billable: !!row.billable,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface TimesheetFilter {
  staffId?: string
  projectId?: string
  taskId?: string
  from?: string
  to?: string
}

/** One flexible filtered query, same optional-filter-builder shape as getAccountBalances in server/utils/accounts.ts. */
export async function getTimesheets(filter: TimesheetFilter = {}): Promise<TimesheetEntry[]> {
  const db = useDatabase()

  const conditions: string[] = []
  const params: string[] = []
  if (filter.staffId) {
    conditions.push('timesheets.staff_id = ?')
    params.push(filter.staffId)
  }
  if (filter.projectId) {
    conditions.push('tasks.project_id = ?')
    params.push(filter.projectId)
  }
  if (filter.taskId) {
    conditions.push('timesheets.task_id = ?')
    params.push(filter.taskId)
  }
  if (filter.from) {
    conditions.push('timesheets.work_date >= ?')
    params.push(filter.from)
  }
  if (filter.to) {
    conditions.push('timesheets.work_date <= ?')
    params.push(filter.to)
  }
  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const rows = await db.prepare(`
    SELECT timesheets.*, staff.name AS staff_name, tasks.title AS task_title, tasks.project_id AS project_id, projects.name AS project_name
    FROM timesheets
    LEFT JOIN staff ON staff.id = timesheets.staff_id
    LEFT JOIN tasks ON tasks.id = timesheets.task_id
    LEFT JOIN projects ON projects.id = tasks.project_id
    ${whereClause}
    ORDER BY timesheets.work_date DESC, timesheets.created_at DESC
  `).all(...params) as TimesheetRow[]

  return rows.map(mapTimesheetRow)
}

export async function getTimesheetById(id: string): Promise<TimesheetEntry | undefined> {
  const db = useDatabase()

  const row = await db.prepare(`
    SELECT timesheets.*, staff.name AS staff_name, tasks.title AS task_title, tasks.project_id AS project_id, projects.name AS project_name
    FROM timesheets
    LEFT JOIN staff ON staff.id = timesheets.staff_id
    LEFT JOIN tasks ON tasks.id = timesheets.task_id
    LEFT JOIN projects ON projects.id = tasks.project_id
    WHERE timesheets.id = ?
  `).get(id) as TimesheetRow | undefined

  return row ? mapTimesheetRow(row) : undefined
}

// A simple heuristic, not a precise measure — same spirit as PROJECT_STATUS_PROGRESS's "rough
// visual progress" comment. Scaled by the requested range length so a two-week query still reads
// sensibly against a weekly constant.
const WEEKLY_CAPACITY_HOURS = 40
const UNDER_THRESHOLD = 0.7
const OVER_THRESHOLD = 1.0

function utilizationStatus(pct: number): UtilizationStatus {
  if (pct < UNDER_THRESHOLD * 100)
    return 'under'
  if (pct > OVER_THRESHOLD * 100)
    return 'over'
  return 'balanced'
}

export async function getResourceUtilization(from: string, to: string): Promise<ResourceUtilizationRow[]> {
  const db = useDatabase()

  const days = Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / (24 * 60 * 60 * 1000)) + 1)
  const capacityHours = WEEKLY_CAPACITY_HOURS * (days / 7)

  const staffRows = await db.prepare(`SELECT id, name FROM staff WHERE status = 'active' ORDER BY name ASC`).all() as { id: string, name: string }[]

  const hoursRows = await db.prepare(`
    SELECT staff_id, SUM(hours) AS total_hours
    FROM timesheets
    WHERE work_date >= ? AND work_date <= ?
    GROUP BY staff_id
  `).all(from, to) as { staff_id: string, total_hours: number | string }[]

  const hoursByStaff = new Map(hoursRows.map(row => [row.staff_id, Number(row.total_hours)]))

  return staffRows.map((staff) => {
    const hoursLogged = hoursByStaff.get(staff.id) ?? 0
    const utilizationPct = capacityHours > 0 ? (hoursLogged / capacityHours) * 100 : 0
    return {
      staffId: staff.id,
      staffName: staff.name,
      hoursLogged,
      capacityHours,
      utilizationPct,
      status: utilizationStatus(utilizationPct),
    }
  })
}

export async function getProjectProfitability(projectId?: string): Promise<ProjectProfitabilityRow[]> {
  const db = useDatabase()

  const projectRows = projectId
    ? await db.prepare('SELECT id, name FROM projects WHERE id = ?').all(projectId) as { id: string, name: string }[]
    : await db.prepare('SELECT id, name FROM projects ORDER BY name ASC').all() as { id: string, name: string }[]

  const revenueRows = await db.prepare(`
    SELECT project_id, SUM(total) AS total_revenue
    FROM invoices
    WHERE project_id IS NOT NULL
    GROUP BY project_id
  `).all() as { project_id: string, total_revenue: number | string }[]
  const revenueByProject = new Map(revenueRows.map(row => [row.project_id, Number(row.total_revenue)]))

  const costRows = await db.prepare(`
    SELECT tasks.project_id AS project_id, SUM(timesheets.hours * timesheets.hourly_rate) AS total_cost
    FROM timesheets
    JOIN tasks ON tasks.id = timesheets.task_id
    WHERE tasks.project_id IS NOT NULL
    GROUP BY tasks.project_id
  `).all() as { project_id: string, total_cost: number | string }[]
  const costByProject = new Map(costRows.map(row => [row.project_id, Number(row.total_cost)]))

  return projectRows.map((project) => {
    const revenue = revenueByProject.get(project.id) ?? 0
    const cost = costByProject.get(project.id) ?? 0
    const margin = revenue - cost
    return {
      projectId: project.id,
      projectName: project.name,
      revenue,
      cost,
      margin,
      marginPct: revenue > 0 ? (margin / revenue) * 100 : null,
    }
  })
}
