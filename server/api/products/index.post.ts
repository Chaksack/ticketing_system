import type { ProductRow } from '../../utils/products'

interface NewProductBody {
  name?: string
  description?: string
  unitPrice?: number
  currency?: string
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const body = await readBody<NewProductBody>(event)

  if (!body?.name?.trim() || body.unitPrice === undefined || body.unitPrice < 0) {
    throw createError({ statusCode: 400, statusMessage: 'name and a non-negative unitPrice are required' })
  }

  await ensureDb()
  const db = useDatabase()

  const id = await nextProductId()
  const now = new Date().toISOString()

  await db.prepare(`
    INSERT INTO products (id, name, description, unit_price, currency, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, body.name.trim(), body.description?.trim() || null, body.unitPrice, body.currency?.trim() || 'GHS', now, now)

  const row = await db.prepare('SELECT * FROM products WHERE id = ?').get(id) as ProductRow

  setResponseStatus(event, 201)
  return { product: mapProductRow(row) }
})
