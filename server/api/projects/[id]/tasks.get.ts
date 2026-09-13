import type { TaskRow } from '../../../utils/mappers'

export default defineEventHandler(async (event) => {
  await requireBd(event)
  await ensureDb()

  const projectId = getRouterParam(event, 'id')
  if (!projectId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing project id' })
  }

  const db = useDatabase()
  const rows = await db.prepare(`
    SELECT tasks.*, epics.title AS epic_title, epics.color AS epic_color,
      sprints.name AS sprint_name, sprints.status AS sprint_status,
      projects.name AS project_name
    FROM tasks
    LEFT JOIN tasks epics ON epics.id = tasks.epic_id
    LEFT JOIN sprints ON sprints.id = tasks.sprint_id
    LEFT JOIN projects ON projects.id = tasks.project_id
    WHERE tasks.project_id = ?
    ORDER BY tasks.created_at DESC
  `).all(projectId) as TaskRow[]

  const tasks = []
  for (const row of rows)
    tasks.push(mapTaskRow(row, await getTaskAssignees(row.id)))

  return { tasks }
})
