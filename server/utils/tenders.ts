import type { Tender, TenderActivityType } from '../../app/types/tender'
import type { TenderActivityRow, TenderDocumentRow, TenderRow } from './mappers'

const TENDER_SELECT = 'SELECT * FROM tenders WHERE id = ?'

export async function loadFullTender(id: string): Promise<Tender> {
  const db = useDatabase()

  const row = await db.prepare(TENDER_SELECT).get(id) as TenderRow | undefined
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Tender not found' })
  }

  const activityRows = await db.prepare('SELECT * FROM tender_activity WHERE tender_id = ? ORDER BY created_at ASC').all(id) as TenderActivityRow[]
  const assignees = await getTenderAssignees(id)
  const documentRows = await db.prepare('SELECT * FROM tender_documents WHERE tender_id = ? ORDER BY created_at ASC').all(id) as TenderDocumentRow[]
  const interactions = await getInteractions('tender', id)

  return mapTenderRow(
    row,
    activityRows.map(activityRow => mapTenderActivityRow(activityRow)),
    assignees,
    documentRows.map(documentRow => mapTenderDocumentRow(documentRow)),
    interactions,
  )
}

export async function logTenderActivity(options: {
  tenderId: string
  type: TenderActivityType
  actorId?: string
  actorName?: string
  fromValue?: string
  toValue?: string
  message?: string
}) {
  const db = useDatabase()
  const id = await nextTenderActivityId()
  const now = new Date().toISOString()

  await db.prepare(`
    INSERT INTO tender_activity (id, tender_id, type, actor_id, actor_name, from_value, to_value, message, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, options.tenderId, options.type, options.actorId ?? null, options.actorName ?? null, options.fromValue ?? null, options.toValue ?? null, options.message ?? null, now)
}
