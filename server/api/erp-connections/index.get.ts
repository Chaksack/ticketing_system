import type { ErpConnectionRow } from '../../utils/erpConnections'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  await ensureDb()

  const db = useDatabase()
  const rows = await db.prepare('SELECT * FROM erp_connections ORDER BY created_at DESC').all() as ErpConnectionRow[]

  return { connections: rows.map(mapErpConnectionRow) }
})
