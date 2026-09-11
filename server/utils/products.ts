import type { LineItem, Product } from '../../app/types/product'

export interface ProductRow {
  id: string
  name: string
  description: string | null
  unit_price: number | string
  currency: string
  created_at: string
  updated_at: string
}

export function mapProductRow(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    unitPrice: Number(row.unit_price),
    currency: row.currency,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface LineItemRow {
  id: string
  product_id: string | null
  product_name: string
  unit_price: number | string
  currency: string
  quantity: number
  created_at: string
}

export function mapLineItemRow(row: LineItemRow): LineItem {
  return {
    id: row.id,
    productId: row.product_id ?? undefined,
    productName: row.product_name,
    unitPrice: Number(row.unit_price),
    currency: row.currency,
    quantity: row.quantity,
    createdAt: row.created_at,
  }
}

export function sumLineItems(lineItems: LineItem[]): number {
  return lineItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
}

export async function getContractLineItems(contractId: string): Promise<LineItem[]> {
  const db = useDatabase()
  const rows = await db.prepare('SELECT * FROM contract_line_items WHERE contract_id = ? ORDER BY created_at ASC').all(contractId) as LineItemRow[]
  return rows.map(row => mapLineItemRow(row))
}
