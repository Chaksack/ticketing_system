import type { ErpConnectionRow } from '../../../utils/erpConnections'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = getRouterParam(event, 'id')
  const body = await readBody<{ path?: string }>(event)

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing connection id' })
  }
  if (!body?.path?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'path is required (e.g. /api/customers/)' })
  }

  await ensureDb()
  const db = useDatabase()

  const row = await db.prepare('SELECT * FROM erp_connections WHERE id = ?').get(id) as ErpConnectionRow | undefined
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Connection not found' })
  }

  const data = await fetchResource(row, body.path.trim())
  return { data }
})
