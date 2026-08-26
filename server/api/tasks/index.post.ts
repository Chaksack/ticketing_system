import type { TaskPriority, TaskStatus, TaskType } from '../../../app/types/task'
import type { TaskRow } from '../../utils/mappers'

interface NewTaskBody {
  type?: TaskType
  title?: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  color?: string
  assigneeId?: string
  epicId?: string
  parentTaskId?: string
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

  await db.prepare(`
    INSERT INTO tasks (
      id, type, title, description, status, priority, color, assignee_id, epic_id, parent_task_id,
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
    body.assigneeId ?? null,
    type === 'task' ? (body.epicId ?? null) : null,
    type === 'subtask' ? (body.parentTaskId ?? null) : null,
    body.startDate ?? null,
    body.dueDate ?? null,
    body.remindAt ?? null,
    user.id,
    now,
    now,
  )

  const row = await db.prepare(`
    SELECT tasks.*, staff.name AS assignee_name, epics.title AS epic_title, epics.color AS epic_color
    FROM tasks
    LEFT JOIN staff ON staff.id = tasks.assignee_id
    LEFT JOIN tasks epics ON epics.id = tasks.epic_id
    WHERE tasks.id = ?
  `).get(id) as TaskRow

  // Don't notify someone for assigning a task to themselves — they already know.
  if (body.assigneeId && body.assigneeId !== user.id) {
    const title = 'Task assigned to you'
    const notifBody = body.title
    const url = '/tasks'

    await createNotification({
      staffId: body.assigneeId,
      type: 'task_assigned',
      title,
      body: notifBody,
      url,
      taskId: id,
    })

    await sendPushToStaff(body.assigneeId, { title, body: notifBody, url })
  }

  setResponseStatus(event, 201)
  return { task: mapTaskRow(row) }
})
