import type { QuoteStatus } from '../../../app/types/quote'
import type { QuoteRow } from '../../utils/quotes'

interface UpdateQuoteBody {
  status?: QuoteStatus
  notes?: string | null
}

const VALID_STATUSES: QuoteStatus[] = ['quoted', 'ordered', 'invoiced']

export default defineEventHandler(async (event) => {
  await requireBd(event)

  const id = getRouterParam(event, 'id')
  const body = await readBody<UpdateQuoteBody>(event)

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing quote id' })
  }

  if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid status' })
  }

  await ensureDb()
  const db = useDatabase()

  const existing = await db.prepare('SELECT * FROM quotes WHERE id = ?').get(id) as QuoteRow | undefined
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Quote not found' })
  }

  const status = body.status ?? existing.status
  const notes = body.notes !== undefined ? body.notes : existing.notes

  await db.prepare('UPDATE quotes SET status = ?, notes = ?, updated_at = ? WHERE id = ?')
    .run(status, notes, new Date().toISOString(), id)

  const quote = await loadFullQuote(id)
  return { quote }
})
