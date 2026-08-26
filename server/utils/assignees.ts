export interface AssigneeRef {
  id: string
  name: string
}

interface AssigneeJoinRow {
  entity_id: string
  id: string
  name: string
}

function groupAssignees(rows: AssigneeJoinRow[]): Map<string, AssigneeRef[]> {
  const map = new Map<string, AssigneeRef[]>()
  for (const row of rows) {
    const list = map.get(row.entity_id) ?? []
    list.push({ id: row.id, name: row.name })
    map.set(row.entity_id, list)
  }
  return map
}

export async function getTaskAssignees(taskId: string): Promise<AssigneeRef[]> {
  const db = useDatabase()
  return await db.prepare(`
    SELECT staff.id, staff.name
    FROM task_assignees
    JOIN staff ON staff.id = task_assignees.staff_id
    WHERE task_assignees.task_id = ?
    ORDER BY staff.name ASC
  `).all(taskId) as AssigneeRef[]
}

// Fetches assignees for every task in one query and groups them in memory — the tasks list
// endpoint already returns the entire table unfiltered, so this matches that same shape.
export async function getAllTaskAssignees(): Promise<Map<string, AssigneeRef[]>> {
  const db = useDatabase()
  const rows = await db.prepare(`
    SELECT task_assignees.task_id AS entity_id, staff.id, staff.name
    FROM task_assignees
    JOIN staff ON staff.id = task_assignees.staff_id
    ORDER BY staff.name ASC
  `).all() as AssigneeJoinRow[]
  return groupAssignees(rows)
}

export async function setTaskAssignees(taskId: string, staffIds: string[]) {
  const db = useDatabase()
  await db.prepare('DELETE FROM task_assignees WHERE task_id = ?').run(taskId)
  for (const staffId of staffIds)
    await db.prepare('INSERT INTO task_assignees (task_id, staff_id) VALUES (?, ?)').run(taskId, staffId)
}

export async function getLeadAssignees(leadId: string): Promise<AssigneeRef[]> {
  const db = useDatabase()
  return await db.prepare(`
    SELECT staff.id, staff.name
    FROM lead_assignees
    JOIN staff ON staff.id = lead_assignees.staff_id
    WHERE lead_assignees.lead_id = ?
    ORDER BY staff.name ASC
  `).all(leadId) as AssigneeRef[]
}

export async function getAllLeadAssignees(): Promise<Map<string, AssigneeRef[]>> {
  const db = useDatabase()
  const rows = await db.prepare(`
    SELECT lead_assignees.lead_id AS entity_id, staff.id, staff.name
    FROM lead_assignees
    JOIN staff ON staff.id = lead_assignees.staff_id
    ORDER BY staff.name ASC
  `).all() as AssigneeJoinRow[]
  return groupAssignees(rows)
}

export async function setLeadAssignees(leadId: string, staffIds: string[]) {
  const db = useDatabase()
  await db.prepare('DELETE FROM lead_assignees WHERE lead_id = ?').run(leadId)
  for (const staffId of staffIds)
    await db.prepare('INSERT INTO lead_assignees (lead_id, staff_id) VALUES (?, ?)').run(leadId, staffId)
}
