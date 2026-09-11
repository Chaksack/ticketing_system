import type { ProductRow } from '../../utils/products'

interface UpdateProductBody {
  name?: string
  description?: string | null
  unitPrice?: number
  currency?: string
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = getRouterParam(event, 'id')
  const body = await readBody<UpdateProductBody>(event)

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing product id' })
  }

  await ensureDb()
  const db = useDatabase()

  const existing = await db.prepare('SELECT * FROM products WHERE id = ?').get(id) as ProductRow | undefined
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Product not found' })
  }

  const name = body.name?.trim() || existing.name
  const description = body.description !== undefined ? body.description : existing.description
  const unitPrice = body.unitPrice !== undefined ? body.unitPrice : existing.unit_price
  const currency = body.currency?.trim() || existing.currency

  if (Number(unitPrice) < 0) {
    throw createError({ statusCode: 400, statusMessage: 'unitPrice must be non-negative' })
  }

  await db.prepare('UPDATE products SET name = ?, description = ?, unit_price = ?, currency = ?, updated_at = ? WHERE id = ?')
    .run(name, description, unitPrice, currency, new Date().toISOString(), id)

  const row = await db.prepare('SELECT * FROM products WHERE id = ?').get(id) as ProductRow
  return { product: mapProductRow(row) }
})
