import type { ApiKey, ApiKeyScope } from '../../app/types/api-key'
import type { ApiKeyRow } from './apiKeyAuth'

export function mapApiKeyRow(row: ApiKeyRow & { created_by_name?: string | null }): ApiKey {
  return {
    id: row.id,
    label: row.label,
    keyPrefix: row.key_prefix,
    scopes: JSON.parse(row.scopes) as ApiKeyScope[],
    createdBy: row.created_by ?? undefined,
    createdByName: row.created_by_name ?? undefined,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at ?? undefined,
    revokedAt: row.revoked_at ?? undefined,
  }
}

export async function getAllApiKeys(): Promise<ApiKey[]> {
  const db = useDatabase()
  const rows = await db.prepare(`
    SELECT api_keys.*, staff.name AS created_by_name
    FROM api_keys
    LEFT JOIN staff ON staff.id = api_keys.created_by
    ORDER BY api_keys.created_at DESC
  `).all() as (ApiKeyRow & { created_by_name: string | null })[]

  return rows.map(mapApiKeyRow)
}
