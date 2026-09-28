import type { ErpConnectionRow } from '../../../utils/erpConnections'

// "Sync now" — the same run the hourly cron does (server/utils/erpSync.ts), for one connection.
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

  const config = parseSyncConfig(row.sync_config)
  if (!config.customers.enabled && !config.projects.enabled) {
    throw createError({ statusCode: 400, statusMessage: 'Enable customer and/or project sync first' })
  }

  const summary = await runErpSync(row)

  const updated = await db.prepare('SELECT * FROM erp_connections WHERE id = ?').get(id) as ErpConnectionRow
  return { connection: mapErpConnectionRow(updated), summary }
})
