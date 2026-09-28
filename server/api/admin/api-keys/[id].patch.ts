import type { ApiKeyScope } from '../../../../app/types/api-key'
import { API_KEY_SCOPES } from '../../../../app/types/api-key'

interface UpdateApiKeyBody {
  label?: string
  scopes?: ApiKeyScope[]
}

// Only the label and scopes are editable — the secret itself never is. To change a key's
// secret, revoke it and issue a new one.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing api key id' })
  }

  const body = await readBody<UpdateApiKeyBody>(event)

  await ensureDb()
  const db = useDatabase()

  const existing = await db.prepare('SELECT id FROM api_keys WHERE id = ?').get(id)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'API key not found' })
  }

  if (body?.label !== undefined) {
    if (!body.label.trim()) {
      throw createError({ statusCode: 400, statusMessage: 'label cannot be empty' })
    }
    await db.prepare('UPDATE api_keys SET label = ? WHERE id = ?').run(body.label.trim(), id)
  }

  if (body?.scopes !== undefined) {
    const scopes = body.scopes.filter(scope => (API_KEY_SCOPES as readonly string[]).includes(scope))
    if (!scopes.length) {
      throw createError({ statusCode: 400, statusMessage: 'At least one valid scope is required' })
    }
    await db.prepare('UPDATE api_keys SET scopes = ? WHERE id = ?').run(JSON.stringify(scopes), id)
  }

  const keys = await getAllApiKeys()
  return { apiKey: keys.find(k => k.id === id) }
})
