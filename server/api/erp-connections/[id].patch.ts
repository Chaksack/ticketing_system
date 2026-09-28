import type { ErpAuthType, ErpSyncConfig } from '../../../app/types/erp-connection'
import type { ErpConnectionRow } from '../../utils/erpConnections'

interface UpdateErpConnectionBody {
  name?: string
  baseUrl?: string
  authType?: ErpAuthType
  authHeader?: string | null
  username?: string | null
  credential?: string
  syncConfig?: ErpSyncConfig
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = getRouterParam(event, 'id')
  const body = await readBody<UpdateErpConnectionBody>(event)

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing connection id' })
  }

  await ensureDb()
  const db = useDatabase()

  const existing = await db.prepare('SELECT * FROM erp_connections WHERE id = ?').get(id) as ErpConnectionRow | undefined
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Connection not found' })
  }

  const name = body.name?.trim() || existing.name
  const baseUrl = body.baseUrl?.trim() || existing.base_url
  const authType = body.authType ?? existing.auth_type
  const authHeader = body.authHeader !== undefined ? body.authHeader : existing.auth_header
  const username = body.username !== undefined ? body.username : existing.username
  // A blank credential in the request leaves the existing one untouched — only a non-empty value replaces it.
  const credentialEncrypted = body.credential?.trim() ? encryptSecret(body.credential.trim()) : existing.credential_encrypted

  let syncConfig = existing.sync_config
  if (body.syncConfig !== undefined) {
    const merged = parseSyncConfig(JSON.stringify(body.syncConfig))
    for (const [resource, config] of Object.entries(merged)) {
      if (config.enabled && (!config.path?.trim() || !config.idField?.trim() || !config.fields.name?.trim())) {
        throw createError({ statusCode: 400, statusMessage: `${resource}: path, id field and name field are required to enable sync` })
      }
    }
    if (merged.projects.enabled && !merged.projects.fields.customerId?.trim()) {
      throw createError({ statusCode: 400, statusMessage: 'projects: the customer id field is required to enable sync' })
    }
    syncConfig = JSON.stringify(merged)
  }

  await db.prepare(`
    UPDATE erp_connections
    SET name = ?, base_url = ?, auth_type = ?, auth_header = ?, username = ?, credential_encrypted = ?, sync_config = ?, updated_at = ?
    WHERE id = ?
  `).run(name, baseUrl, authType, authHeader, username, credentialEncrypted, syncConfig, new Date().toISOString(), id)

  const row = await db.prepare('SELECT * FROM erp_connections WHERE id = ?').get(id) as ErpConnectionRow
  return { connection: mapErpConnectionRow(row) }
})
