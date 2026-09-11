import type { RegardingType } from '../../app/types/interaction'
import type { LineItem } from '../../app/types/product'
import type { Quote } from '../../app/types/quote'
import type { LineItemRow } from './products'

export interface QuoteRow {
  id: string
  regarding_type: string
  regarding_id: string
  status: string
  notes: string | null
  created_by: string | null
  created_by_name?: string | null
  created_at: string
  updated_at: string
}

export function mapQuoteRow(row: QuoteRow, lineItems: LineItem[] = []): Quote {
  return {
    id: row.id,
    regardingType: row.regarding_type as RegardingType,
    regardingId: row.regarding_id,
    status: row.status as Quote['status'],
    notes: row.notes ?? undefined,
    lineItems,
    total: sumLineItems(lineItems),
    createdBy: row.created_by ?? undefined,
    createdByName: row.created_by_name ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function loadFullQuote(id: string): Promise<Quote> {
  const db = useDatabase()

  const row = await db.prepare(`
    SELECT quotes.*, staff.name AS created_by_name
    FROM quotes
    LEFT JOIN staff ON staff.id = quotes.created_by
    WHERE quotes.id = ?
  `).get(id) as QuoteRow | undefined

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Quote not found' })
  }

  const lineItemRows = await db.prepare('SELECT * FROM quote_line_items WHERE quote_id = ? ORDER BY created_at ASC').all(id) as LineItemRow[]

  return mapQuoteRow(row, lineItemRows.map(lineItemRow => mapLineItemRow(lineItemRow)))
}

export async function getQuotesForRecord(regardingType: RegardingType, regardingId: string): Promise<Quote[]> {
  const db = useDatabase()

  const rows = await db.prepare(`
    SELECT quotes.*, staff.name AS created_by_name
    FROM quotes
    LEFT JOIN staff ON staff.id = quotes.created_by
    WHERE quotes.regarding_type = ? AND quotes.regarding_id = ?
    ORDER BY quotes.created_at DESC
  `).all(regardingType, regardingId) as QuoteRow[]

  const quotes: Quote[] = []
  for (const row of rows) {
    const lineItemRows = await db.prepare('SELECT * FROM quote_line_items WHERE quote_id = ? ORDER BY created_at ASC').all(row.id) as LineItemRow[]
    quotes.push(mapQuoteRow(row, lineItemRows.map(lineItemRow => mapLineItemRow(lineItemRow))))
  }

  return quotes
}
