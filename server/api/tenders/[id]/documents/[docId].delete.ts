import type { TenderDocumentRow } from '../../../../utils/mappers'
import { del } from '@vercel/blob'

export default defineEventHandler(async (event) => {
  const user = await requireBd(event)
  const tenderId = getRouterParam(event, 'id')
  const docId = getRouterParam(event, 'docId')

  if (!tenderId || !docId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing tender or document id' })
  }

  await ensureDb()
  const db = useDatabase()

  const document = await db.prepare('SELECT * FROM tender_documents WHERE id = ? AND tender_id = ?').get(docId, tenderId) as TenderDocumentRow | undefined
  if (!document) {
    throw createError({ statusCode: 404, statusMessage: 'Document not found' })
  }

  await del(document.url).catch(() => {})
  await db.prepare('DELETE FROM tender_documents WHERE id = ?').run(docId)

  await logTenderActivity({
    tenderId,
    type: 'document_removed',
    actorId: user.id,
    actorName: user.name,
    fromValue: document.name,
  })

  const tender = await loadFullTender(tenderId)
  return { tender }
})
