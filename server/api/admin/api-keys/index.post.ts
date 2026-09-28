import type { ApiKeyScope } from '../../../../app/types/api-key'
import { API_KEY_SCOPES } from '../../../../app/types/api-key'

interface NewApiKeyBody {
  label?: string
  scopes?: ApiKeyScope[]
}

export default defineEventHandler(async (event) => {
  const user = await requireAdmin(event)

  const body = await readBody<NewApiKeyBody>(event)

  if (!body?.label?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'label is required' })
  }

  const scopes = (body.scopes ?? []).filter(scope => (API_KEY_SCOPES as readonly string[]).includes(scope))
  if (!scopes.length) {
    throw createError({ statusCode: 400, statusMessage: 'At least one valid scope is required' })
  }

  await ensureDb()
  const db = useDatabase()

  const { key, prefix, hash } = generateApiKey()
  const id = await nextApiKeyId()
  const now = new Date().toISOString()

  await db.prepare(`
    INSERT INTO api_keys (id, label, key_prefix, key_hash, scopes, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, body.label.trim(), prefix, hash, JSON.stringify(scopes), user.id, now)

  const keys = await getAllApiKeys()
  const created = keys.find(k => k.id === id)!

  // The only moment the plaintext key ever leaves the server — it's never stored or returned again.
  setResponseStatus(event, 201)
  return { apiKey: created, key }
})
