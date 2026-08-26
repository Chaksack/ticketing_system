import type { TaskRow } from '../../utils/mappers'

const TASK_LIST_SELECT = `
  SELECT tasks.*, epics.title AS epic_title, epics.color AS epic_color
  FROM tasks
  LEFT JOIN tasks epics ON epics.id = tasks.epic_id
`

export default defineEventHandler(async (event) => {
  await requireBd(event)
  await ensureDb()

  const db = useDatabase()
  const rows = await db.prepare(`${TASK_LIST_SELECT} ORDER BY tasks.created_at DESC`).all() as TaskRow[]
  const assigneesByTask = await getAllTaskAssignees()

  return { tasks: rows.map(row => mapTaskRow(row, assigneesByTask.get(row.id) ?? [])) }
})
