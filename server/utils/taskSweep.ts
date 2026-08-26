import type { TaskRow } from './mappers'

export async function checkTaskReminders() {
  await ensureDb()
  const db = useDatabase()
  const now = new Date().toISOString()

  const due = await db.prepare(`
    SELECT * FROM tasks
    WHERE status != 'done' AND remind_at IS NOT NULL AND remind_at <= ? AND reminder_sent = 0
  `).all(now) as TaskRow[]

  for (const task of due) {
    const assignees = await getTaskAssignees(task.id)

    if (assignees.length) {
      const title = `Reminder: ${task.title}`
      const body = task.due_date
        ? `Due ${new Date(task.due_date).toLocaleDateString()}`
        : 'This task needs your attention.'
      const url = '/tasks'

      for (const assignee of assignees) {
        await createNotification({ staffId: assignee.id, type: 'task_reminder', title, body, url, taskId: task.id })
        await sendPushToStaff(assignee.id, { title, body, url })
      }
    }

    await db.prepare('UPDATE tasks SET reminder_sent = 1 WHERE id = ?').run(task.id)
  }

  return { reminded: due.length }
}
