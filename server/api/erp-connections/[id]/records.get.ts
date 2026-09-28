interface ErpImportRecordRow {
  id: string
  connection_id: string
  path: string
  raw_json: string
  fetched_at: string
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing connection id' })
  }

  await ensureDb()
  const db = useDatabase()

  const rows = await db.prepare(`
    SELECT * FROM erp_import_records WHERE connection_id = ? ORDER BY fetched_at DESC LIMIT 50
  `).all(id) as ErpImportRecordRow[]

  const records = rows.map(row => ({
    id: row.id,
    connectionId: row.connection_id,
    path: row.path,
    rawJson: JSON.parse(row.raw_json),
    fetchedAt: row.fetched_at,
  }))

  return { records }
})
