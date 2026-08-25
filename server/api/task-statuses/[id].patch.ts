interface UpdateTaskStatusBody {
  label?: string
}

export default defineEventHandler(async (event) => {
  await requireBd(event)

  const id = getRouterParam(event, 'id')
  const body = await readBody<UpdateTaskStatusBody>(event)

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing status id' })
  }

  if (!body?.label?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'label is required' })
  }

  await ensureDb()
  const db = useDatabase()

  const existing = await db.prepare('SELECT * FROM task_statuses WHERE id = ?').get(id)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Status not found' })
  }

  const now = new Date().toISOString()
  await db.prepare('UPDATE task_statuses SET label = ?, updated_at = ? WHERE id = ?').run(body.label.trim(), now, id)

  const row = await db.prepare('SELECT * FROM task_statuses WHERE id = ?').get(id) as { id: string, label: string, position: number }
  return { status: row }
})
