import type { ErpConnection } from '../../app/types/erp-connection'
import { Buffer } from 'node:buffer'

export interface ErpConnectionRow {
  id: string
  name: string
  base_url: string
  auth_type: string
  auth_header: string | null
  username: string | null
  credential_encrypted: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  last_synced_at: string | null
  last_sync_status: string | null
}

export function mapErpConnectionRow(row: ErpConnectionRow): ErpConnection {
  return {
    id: row.id,
    name: row.name,
    baseUrl: row.base_url,
    authType: row.auth_type as ErpConnection['authType'],
    authHeader: row.auth_header ?? undefined,
    username: row.username ?? undefined,
    hasCredential: !!row.credential_encrypted,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastSyncedAt: row.last_synced_at ?? undefined,
    lastSyncStatus: row.last_sync_status ?? undefined,
  }
}

/** Builds the auth header(s) for an outbound call to the external ERP — decrypts the stored credential on demand, never logs or returns it. */
function buildAuthHeaders(row: ErpConnectionRow): Record<string, string> {
  if (row.auth_type === 'none' || !row.credential_encrypted)
    return {}

  const credential = decryptSecret(row.credential_encrypted)

  if (row.auth_type === 'bearer')
    return { Authorization: `Bearer ${credential}` }

  if (row.auth_type === 'api_key')
    return { [row.auth_header || 'X-API-Key']: credential }

  if (row.auth_type === 'basic') {
    const encoded = Buffer.from(`${row.username ?? ''}:${credential}`).toString('base64')
    return { Authorization: `Basic ${encoded}` }
  }

  return {}
}

export async function testConnection(row: ErpConnectionRow): Promise<{ ok: boolean, status: number }> {
  try {
    const response = await fetch(row.base_url, { headers: buildAuthHeaders(row) })
    return { ok: response.ok, status: response.status }
  }
  catch {
    return { ok: false, status: 0 }
  }
}

/** Fetches one path from the external ERP, logs the raw response into erp_import_records, and updates the connection's sync status. */
export async function fetchResource(row: ErpConnectionRow, path: string): Promise<unknown> {
  const db = useDatabase()
  const url = new URL(path, row.base_url).toString()
  const now = new Date().toISOString()

  let status: 'ok' | 'error' = 'ok'
  let data: unknown

  try {
    const response = await fetch(url, { headers: buildAuthHeaders(row) })
    const text = await response.text()
    if (!response.ok) {
      status = 'error'
      data = { statusCode: response.status, body: text }
    }
    else {
      try {
        data = JSON.parse(text)
      }
      catch {
        data = text
      }
    }
  }
  catch (error: any) {
    status = 'error'
    data = { error: error?.message ?? 'Request failed' }
  }

  const recordId = await nextErpImportRecordId()
  await db.prepare(`
    INSERT INTO erp_import_records (id, connection_id, path, raw_json, fetched_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(recordId, row.id, path, JSON.stringify(data), now)

  await db.prepare('UPDATE erp_connections SET last_synced_at = ?, last_sync_status = ? WHERE id = ?')
    .run(now, status, row.id)

  if (status === 'error') {
    throw createError({ statusCode: 502, statusMessage: 'The external ERP returned an error — see the stored record for details' })
  }

  return data
}
