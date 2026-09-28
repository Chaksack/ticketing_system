import type { ErpAuthType } from '../../../app/types/erp-connection'
import type { ErpConnectionRow } from '../../utils/erpConnections'

interface NewErpConnectionBody {
  name?: string
  baseUrl?: string
  authType?: ErpAuthType
  authHeader?: string
  username?: string
  credential?: string
}

const VALID_AUTH_TYPES: ErpAuthType[] = ['none', 'bearer', 'api_key', 'basic']

export default defineEventHandler(async (event) => {
  const user = await requireAdmin(event)

  const body = await readBody<NewErpConnectionBody>(event)

  if (!body?.name?.trim() || !body?.baseUrl?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'name and baseUrl are required' })
  }

  const authType = body.authType ?? 'none'
  if (!VALID_AUTH_TYPES.includes(authType)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid authType' })
  }

  try {
    // eslint-disable-next-line no-new
    new URL(body.baseUrl.trim())
  }
  catch {
    throw createError({ statusCode: 400, statusMessage: 'baseUrl must be a valid URL' })
  }

  await ensureDb()
  const db = useDatabase()

  const id = await nextErpConnectionId()
  const now = new Date().toISOString()
  const credentialEncrypted = body.credential?.trim() ? encryptSecret(body.credential.trim()) : null

  await db.prepare(`
    INSERT INTO erp_connections (id, name, base_url, auth_type, auth_header, username, credential_encrypted, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, body.name.trim(), body.baseUrl.trim(), authType, body.authHeader?.trim() || null, body.username?.trim() || null, credentialEncrypted, user.id, now, now)

  const row = await db.prepare('SELECT * FROM erp_connections WHERE id = ?').get(id) as ErpConnectionRow

  setResponseStatus(event, 201)
  return { connection: mapErpConnectionRow(row) }
})
