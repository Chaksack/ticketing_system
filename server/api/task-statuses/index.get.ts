export default defineEventHandler(async (event) => {
  await requireBd(event)
  await ensureDb()

  const db = useDatabase()
  const rows = await db.prepare('SELECT * FROM task_statuses ORDER BY position ASC').all() as {
    id: string
    label: string
    position: number
  }[]

  return { statuses: rows }
})
