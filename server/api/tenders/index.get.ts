import type { TenderRow } from '../../utils/mappers'

export default defineEventHandler(async (event) => {
  await requireBd(event)
  await ensureDb()

  const db = useDatabase()
  const rows = await db.prepare(`
    SELECT * FROM tenders ORDER BY created_at DESC
  `).all() as TenderRow[]

  const assigneesByTender = await getAllTenderAssignees()

  return { tenders: rows.map(row => mapTenderRow(row, [], assigneesByTender.get(row.id) ?? [])) }
})
