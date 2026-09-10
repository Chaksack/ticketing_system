import { put } from '@vercel/blob'

const MAX_SIZE = 4 * 1024 * 1024

// Vercel Node.js serverless functions cap request bodies around ~4.5MB, and this upload relays
// through the function (same pattern as server/api/chat/channels/[id]/messages.post.ts) rather
// than going straight from the browser to Blob storage — so the cap stays safely under that ceiling.
const ALLOWED_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/zip': 'zip',
}

export default defineEventHandler(async (event) => {
  const user = await requireBd(event)
  const clientId = getRouterParam(event, 'id')

  if (!clientId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing client id' })
  }

  await ensureDb()
  const db = useDatabase()

  const client = await db.prepare('SELECT id FROM clients WHERE id = ?').get(clientId)
  if (!client) {
    throw createError({ statusCode: 404, statusMessage: 'Client not found' })
  }

  const parts = await readMultipartFormData(event)
  const file = parts?.find(part => part.name === 'document' && part.filename)

  if (!file) {
    throw createError({ statusCode: 400, statusMessage: 'No document was provided' })
  }

  if (!file.type || !ALLOWED_TYPES[file.type]) {
    throw createError({ statusCode: 400, statusMessage: 'That file type is not supported' })
  }

  if (file.data.length > MAX_SIZE) {
    throw createError({ statusCode: 400, statusMessage: 'Document must be smaller than 4MB' })
  }

  const ext = ALLOWED_TYPES[file.type]
  const blob = await put(`client-documents/${clientId}/${user.id}-${Date.now()}.${ext}`, file.data, {
    access: 'public',
    contentType: file.type,
  })

  const documentId = await nextClientDocumentId()
  const now = new Date().toISOString()
  const name = file.filename ?? 'document'

  await db.prepare(`
    INSERT INTO client_documents (id, client_id, name, url, type, size, uploaded_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(documentId, clientId, name, blob.url, file.type, file.data.length, user.id, now)

  await logClientActivity({
    clientId,
    type: 'document_added',
    actorId: user.id,
    actorName: user.name,
    toValue: name,
  })

  const clientFull = await loadFullClient(clientId)

  setResponseStatus(event, 201)
  return { client: clientFull }
})
