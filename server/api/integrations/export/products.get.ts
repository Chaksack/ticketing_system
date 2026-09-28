import type { ProductRow } from '../../../utils/products'

const HOUR_MS = 60 * 60 * 1000

export default defineEventHandler(async (event) => {
  const apiKey = await requireApiKey(event, 'products')

  const limit = await checkRateLimit('erp-export', apiKey.id, 300, HOUR_MS)
  if (!limit.allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests — please slow down.' })
  }

  await ensureDb()
  const db = useDatabase()
  const rows = await db.prepare('SELECT * FROM products ORDER BY name ASC').all() as ProductRow[]
  const items = rows.map(row => mapProductRow(row))

  return { resource: 'products', count: items.length, items }
})
