import type { TaskPriority, TaskStatus } from '../../../app/types/task'
import type { TaskRow } from '../../utils/mappers'

interface UpdateTaskBody {
  title?: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  color?: string | null
  assigneeId?: string | null
  epicId?: string | null
  parentTaskId?: string | null
  startDate?: string | null
  dueDate?: string | null
  remindAt?: string | null
}

export default defineEventHandler(async (event) => {
  const user = await requireBd(event)

  const id = getRouterParam(event, 'id')
  const body = await readBody<UpdateTaskBody>(event)

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing task id' })
  }

  await ensureDb()
  const db = useDatabase()

  const existing = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Task not found' })
  }

  const title = body.title ?? existing.title
  const description = body.description !== undefined ? body.description : existing.description
  const status = body.status ?? existing.status as TaskStatus
  const priority = body.priority ?? existing.priority as TaskPriority
  const color = body.color !== undefined ? body.color : existing.color
  const assigneeId = body.assigneeId !== undefined ? body.assigneeId : existing.assignee_id
  const epicId = body.epicId !== undefined ? body.epicId : existing.epic_id
  const parentTaskId = body.parentTaskId !== undefined ? body.parentTaskId : existing.parent_task_id
  const startDate = body.startDate !== undefined ? body.startDate : existing.start_date
  const dueDate = body.dueDate !== undefined ? body.dueDate : existing.due_date
  const remindAt = body.remindAt !== undefined ? body.remindAt : existing.remind_at
  // Changing the reminder time re-arms it so a new push can fire for the new time.
  const reminderSent = body.remindAt !== undefined && body.remindAt !== existing.remind_at ? 0 : existing.reminder_sent
  const now = new Date().toISOString()

  await db.prepare(`
    UPDATE tasks
    SET title = ?, description = ?, status = ?, priority = ?, color = ?, assignee_id = ?, epic_id = ?,
        parent_task_id = ?, start_date = ?, due_date = ?, remind_at = ?, reminder_sent = ?, updated_at = ?
    WHERE id = ?
  `).run(title, description, status, priority, color, assigneeId, epicId, parentTaskId, startDate, dueDate, remindAt, reminderSent, now, id)

  // Only notify when the assignee actually changed to someone new — not on unrelated edits,
  // and never for assigning a task to yourself.
  if (assigneeId && assigneeId !== existing.assignee_id && assigneeId !== user.id) {
    const notifTitle = 'Task assigned to you'
    const notifBody = title
    const url = '/tasks'

    await createNotification({
      staffId: assigneeId,
      type: 'task_assigned',
      title: notifTitle,
      body: notifBody,
      url,
      taskId: id,
    })

    await sendPushToStaff(assigneeId, { title: notifTitle, body: notifBody, url })
  }

  const row = await db.prepare(`
    SELECT tasks.*, staff.name AS assignee_name, epics.title AS epic_title, epics.color AS epic_color
    FROM tasks
    LEFT JOIN staff ON staff.id = tasks.assignee_id
    LEFT JOIN tasks epics ON epics.id = tasks.epic_id
    WHERE tasks.id = ?
  `).get(id) as TaskRow

  return { task: mapTaskRow(row) }
})
