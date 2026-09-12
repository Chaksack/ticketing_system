import type { ProductRow } from '../../utils/products'

export default defineEventHandler(async (event) => {
  await requireBilling(event)
  await ensureDb()

  const db = useDatabase()
  const rows = await db.prepare('SELECT * FROM products ORDER BY name ASC').all() as ProductRow[]

  return { products: rows.map(row => mapProductRow(row)) }
})
