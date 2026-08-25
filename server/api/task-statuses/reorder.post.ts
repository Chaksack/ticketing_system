interface ReorderBody {
  ids?: string[]
}

export default defineEventHandler(async (event) => {
  await requireBd(event)

  const body = await readBody<ReorderBody>(event)

  if (!Array.isArray(body?.ids) || !body.ids.length) {
    throw createError({ statusCode: 400, statusMessage: 'ids is required' })
  }

  await ensureDb()
  const db = useDatabase()

  const now = new Date().toISOString()
  for (const [index, id] of body.ids.entries()) {
    await db.prepare('UPDATE task_statuses SET position = ?, updated_at = ? WHERE id = ?').run(index, now, id)
  }

  const rows = await db.prepare('SELECT * FROM task_statuses ORDER BY position ASC').all()
  return { statuses: rows }
})
