import type { TicketAttachment } from '../../../app/types/ticket'
import { put } from '@vercel/blob'

const MAX_SIZE = 4 * 1024 * 1024

// Same relay-through-the-function pattern as the other Vercel Blob upload routes (see
// server/api/chat/channels/[id]/messages.post.ts) — keeps well under Vercel's ~4.5MB
// serverless body cap.
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

// Uploads happen before the ticket they'll be attached to exists, so this is scoped by IP
// rather than by ticket/email — generous enough for a handful of screenshots per request,
// tight enough that this can't become a free anonymous file host.
const UPLOADS_PER_IP_PER_HOUR = 20
const HOUR_MS = 60 * 60 * 1000

export default defineEventHandler(async (event) => {
  // This handler only ever receives POST (Nitro dispatches OPTIONS to attachments.options.ts).
  applyPortalCors(event)

  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  const ipLimit = await checkRateLimit('ticket-attachment-ip', ip, UPLOADS_PER_IP_PER_HOUR, HOUR_MS)
  if (!ipLimit.allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many files uploaded recently. Please try again later.' })
  }

  const parts = await readMultipartFormData(event)
  const file = parts?.find(part => part.name === 'file' && part.filename)

  if (!file) {
    throw createError({ statusCode: 400, statusMessage: 'No file was provided' })
  }
  if (!file.type || !ALLOWED_TYPES[file.type]) {
    throw createError({ statusCode: 400, statusMessage: 'That file type is not supported' })
  }
  if (file.data.length > MAX_SIZE) {
    throw createError({ statusCode: 400, statusMessage: 'File must be smaller than 4MB' })
  }

  const ext = ALLOWED_TYPES[file.type]
  const blob = await put(`ticket-attachments/portal-${ip}-${Date.now()}.${ext}`, file.data, {
    access: 'public',
    contentType: file.type,
  })

  const attachment: TicketAttachment = {
    name: file.filename ?? 'attachment',
    url: blob.url,
    type: file.type,
    size: file.data.length,
  }

  setResponseStatus(event, 201)
  return { attachment }
})
