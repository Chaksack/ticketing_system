import type { JournalEntryRow } from '../../utils/ledger'

export default defineEventHandler(async (event) => {
  await requireFinance(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing journal entry id' })
  }

  await ensureDb()
  const db = useDatabase()

  const existing = await db.prepare('SELECT * FROM journal_entries WHERE id = ?').get(id) as JournalEntryRow | undefined
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Journal entry not found' })
  }

  if (existing.source !== 'manual') {
    throw createError({ statusCode: 400, statusMessage: 'This entry was posted automatically — remove its source record instead (e.g. delete the receipt)' })
  }

  await deleteJournalEntry(id)

  return { success: true }
})
