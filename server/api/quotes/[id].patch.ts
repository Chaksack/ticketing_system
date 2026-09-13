import type { QuoteRow } from '../../utils/quotes'

interface UpdateQuoteBody {
  notes?: string | null
}

export default defineEventHandler(async (event) => {
  await requireBd(event)

  const id = getRouterParam(event, 'id')
  const body = await readBody<UpdateQuoteBody>(event)

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing quote id' })
  }

  await ensureDb()
  const db = useDatabase()

  const existing = await db.prepare('SELECT * FROM quotes WHERE id = ?').get(id) as QuoteRow | undefined
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Quote not found' })
  }

  const notes = body.notes !== undefined ? body.notes : existing.notes

  await db.prepare('UPDATE quotes SET notes = ?, updated_at = ? WHERE id = ?')
    .run(notes, new Date().toISOString(), id)

  const quote = await loadFullQuote(id)
  return { quote }
})
