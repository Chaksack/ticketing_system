import type { TaskRow } from '../../../utils/mappers'

export default defineEventHandler(async (event) => {
  await requireBd(event)
  await ensureDb()

  const tenderId = getRouterParam(event, 'id')
  if (!tenderId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing tender id' })
  }

  const db = useDatabase()
  const rows = await db.prepare(`
    SELECT tasks.*, epics.title AS epic_title, epics.color AS epic_color,
      sprints.name AS sprint_name, sprints.status AS sprint_status,
      tenders.title AS tender_name
    FROM tasks
    LEFT JOIN tasks epics ON epics.id = tasks.epic_id
    LEFT JOIN sprints ON sprints.id = tasks.sprint_id
    LEFT JOIN tenders ON tenders.id = tasks.tender_id
    WHERE tasks.tender_id = ?
    ORDER BY tasks.created_at DESC
  `).all(tenderId) as TaskRow[]

  const tasks = []
  for (const row of rows)
    tasks.push(mapTaskRow(row, await getTaskAssignees(row.id)))

  return { tasks }
})
