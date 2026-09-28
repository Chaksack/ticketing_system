// Permanently removes the key row. Distinct from revoke (revoke.post.ts), which only disables
// the key and keeps it listed for the audit trail.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing api key id' })
  }

  await ensureDb()
  const db = useDatabase()

  const existing = await db.prepare('SELECT id FROM api_keys WHERE id = ?').get(id)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'API key not found' })
  }

  await db.prepare('DELETE FROM api_keys WHERE id = ?').run(id)

  return { ok: true }
})
