import type { LeadDocumentRow } from '../../../../utils/mappers'
import { del } from '@vercel/blob'

export default defineEventHandler(async (event) => {
  const user = await requireBd(event)
  const leadId = getRouterParam(event, 'id')
  const docId = getRouterParam(event, 'docId')

  if (!leadId || !docId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing lead or document id' })
  }

  await ensureDb()
  const db = useDatabase()

  const document = await db.prepare('SELECT * FROM lead_documents WHERE id = ? AND lead_id = ?').get(docId, leadId) as LeadDocumentRow | undefined
  if (!document) {
    throw createError({ statusCode: 404, statusMessage: 'Document not found' })
  }

  await del(document.url).catch(() => {})
  await db.prepare('DELETE FROM lead_documents WHERE id = ?').run(docId)

  await logLeadActivity({
    leadId,
    type: 'document_removed',
    actorId: user.id,
    actorName: user.name,
    fromValue: document.name,
  })

  const lead = await loadFullLead(leadId)
  return { lead }
})
