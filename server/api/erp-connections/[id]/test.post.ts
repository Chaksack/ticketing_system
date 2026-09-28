import type { ErpConnectionRow } from '../../../utils/erpConnections'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing connection id' })
  }

  await ensureDb()
  const db = useDatabase()

  const row = await db.prepare('SELECT * FROM erp_connections WHERE id = ?').get(id) as ErpConnectionRow | undefined
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Connection not found' })
  }

  const result = await testConnection(row)
  return result
})
