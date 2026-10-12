import { Buffer } from 'node:buffer'

// 1×1 transparent GIF.
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')

/** Journey email open tracking: /api/public/m/<messageId>.gif?workspace=<slug> */
export default defineEventHandler(async (event) => {
  const messageId = (getRouterParam(event, 'file') ?? '').replace(/\.gif$/, '')
  try {
    await useWorkspaceFromRequest(event)
    await ensureDb()
    if (/^[a-f0-9]{32}$/.test(messageId))
      await useTenantDb().prepare('UPDATE journey_messages SET opened_at = COALESCE(opened_at, ?) WHERE id = ?').run(new Date().toISOString(), messageId)
  }
  catch {
    // Tracking must never break the email.
  }
  setResponseHeader(event, 'Cache-Control', 'no-store, max-age=0')
  // send() rather than returning the Buffer: a Buffer return type makes Nitro's route typings explode.
  return send(event, PIXEL, 'image/gif')
})
