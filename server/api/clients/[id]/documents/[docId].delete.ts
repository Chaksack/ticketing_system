import type { ClientDocumentRow } from '../../../../utils/mappers'
import { del } from '@vercel/blob'

export default defineEventHandler(async (event) => {
  const user = await requireBd(event)
  const clientId = getRouterParam(event, 'id')
  const docId = getRouterParam(event, 'docId')

  if (!clientId || !docId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing client or document id' })
  }

  await ensureDb()
  const db = useDatabase()

  const document = await db.prepare('SELECT * FROM client_documents WHERE id = ? AND client_id = ?').get(docId, clientId) as ClientDocumentRow | undefined
  if (!document) {
    throw createError({ statusCode: 404, statusMessage: 'Document not found' })
  }

  await del(document.url).catch(() => {})
  await db.prepare('DELETE FROM client_documents WHERE id = ?').run(docId)

  await logClientActivity({
    clientId,
    type: 'document_removed',
    actorId: user.id,
    actorName: user.name,
    fromValue: document.name,
  })

  const client = await loadFullClient(clientId)
  return { client }
})
