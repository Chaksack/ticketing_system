import type { TaskPriority, TaskStatus, TaskType } from '../../../app/types/task'
import type { TaskRow } from '../../utils/mappers'

interface NewTaskBody {
  type?: TaskType
  title?: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  color?: string
  assigneeIds?: string[]
  epicId?: string
  parentTaskId?: string
  sprintId?: string
  startDate?: string
  dueDate?: string
  remindAt?: string
}

export default defineEventHandler(async (event) => {
  const user = await requireBd(event)

  const body = await readBody<NewTaskBody>(event)

  if (!body?.title) {
    throw createError({ statusCode: 400, statusMessage: 'title is required' })
  }

  await ensureDb()
  const db = useDatabase()

  const id = await nextTaskId()
  const now = new Date().toISOString()
  const type = body.type ?? 'task'
  const assigneeIds = body.assigneeIds ?? []

  await db.prepare(`
    INSERT INTO tasks (
      id, type, title, description, status, priority, color, epic_id, parent_task_id, sprint_id,
      start_date, due_date, remind_at, reminder_sent, created_by, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
  `).run(
    id,
    type,
    body.title,
    body.description ?? null,
    body.status ?? 'todo',
    body.priority ?? 'medium',
    body.color ?? null,
    type === 'task' ? (body.epicId ?? null) : null,
    type === 'subtask' ? (body.parentTaskId ?? null) : null,
    type !== 'epic' ? (body.sprintId ?? null) : null,
    body.startDate ?? null,
    body.dueDate ?? null,
    body.remindAt ?? null,
    user.id,
    now,
    now,
  )

  await setTaskAssignees(id, assigneeIds)

  const row = await db.prepare(`
    SELECT tasks.*, epics.title AS epic_title, epics.color AS epic_color,
      sprints.name AS sprint_name, sprints.status AS sprint_status
    FROM tasks
    LEFT JOIN tasks epics ON epics.id = tasks.epic_id
    LEFT JOIN sprints ON sprints.id = tasks.sprint_id
    WHERE tasks.id = ?
  `).get(id) as TaskRow

  // Don't notify someone for assigning a task to themselves — they already know.
  const notifyIds = assigneeIds.filter(staffId => staffId !== user.id)
  if (notifyIds.length) {
    const title = 'Task assigned to you'
    const notifBody = body.title
    const url = '/tasks'

    for (const staffId of notifyIds) {
      await createNotification({ staffId, type: 'task_assigned', title, body: notifBody, url, taskId: id })
      await sendPushToStaff(staffId, { title, body: notifBody, url })
    }
  }

  const assignees = await getTaskAssignees(id)

  setResponseStatus(event, 201)
  return { task: mapTaskRow(row, assignees) }
})
