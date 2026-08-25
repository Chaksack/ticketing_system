interface NewTaskStatusBody {
  label?: string
}

export default defineEventHandler(async (event) => {
  await requireBd(event)

  const body = await readBody<NewTaskStatusBody>(event)

  if (!body?.label?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'label is required' })
  }

  await ensureDb()
  const db = useDatabase()

  const maxPositionRow = await db.prepare('SELECT MAX(position) as max_position FROM task_statuses').get() as { max_position: number | null }
  const position = (maxPositionRow.max_position ?? -1) + 1

  const id = await nextTaskStatusId()
  const now = new Date().toISOString()

  await db.prepare(`
    INSERT INTO task_statuses (id, label, position, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, body.label.trim(), position, now, now)

  setResponseStatus(event, 201)
  return { status: { id, label: body.label.trim(), position } }
})
