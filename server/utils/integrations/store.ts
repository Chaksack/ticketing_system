import type { IntegrationProvider, IntegrationStatus } from '../../../app/types/integration'
import type { NormalizedTokenResult } from './providers'
import { INTEGRATION_PROVIDERS } from './providers'

export interface StaffIntegrationRow {
  id: string
  staff_id: string
  provider: string
  access_token: string | null
  refresh_token: string | null
  token_expires_at: string | null
  scope: string | null
  external_account_id: string | null
  external_account_label: string | null
  metadata: string | null
  connected_at: string
  updated_at: string
}

export async function getStaffIntegration(staffId: string, provider: IntegrationProvider): Promise<StaffIntegrationRow | undefined> {
  const db = useDatabase()
  return await db.prepare('SELECT * FROM staff_integrations WHERE staff_id = ? AND provider = ?').get(staffId, provider) as StaffIntegrationRow | undefined
}

export async function getStaffIntegrationStatus(staffId: string, provider: IntegrationProvider): Promise<IntegrationStatus> {
  const row = await getStaffIntegration(staffId, provider)
  return {
    provider,
    label: INTEGRATION_PROVIDERS[provider].label,
    connected: !!row,
    externalAccountLabel: row?.external_account_label ?? undefined,
    connectedAt: row?.connected_at ?? undefined,
  }
}

/** Decrypts and returns the access token for an active integration, or null if not connected. */
export async function getDecryptedAccessToken(staffId: string, provider: IntegrationProvider): Promise<{ accessToken: string, externalAccountId: string | null } | null> {
  const row = await getStaffIntegration(staffId, provider)
  if (!row?.access_token)
    return null

  return { accessToken: decryptSecret(row.access_token), externalAccountId: row.external_account_id }
}

export async function upsertStaffIntegration(staffId: string, provider: IntegrationProvider, result: NormalizedTokenResult) {
  await ensureDb()
  const db = useDatabase()

  const existing = await getStaffIntegration(staffId, provider)
  const now = new Date().toISOString()
  const encryptedAccessToken = encryptSecret(result.accessToken)
  const encryptedRefreshToken = result.refreshToken ? encryptSecret(result.refreshToken) : null

  if (existing) {
    await db.prepare(`
      UPDATE staff_integrations
      SET access_token = ?, refresh_token = ?, token_expires_at = ?, scope = ?, external_account_id = ?, external_account_label = ?, metadata = ?, updated_at = ?
      WHERE id = ?
    `).run(encryptedAccessToken, encryptedRefreshToken, result.expiresAt ?? null, result.scope ?? null, result.externalAccountId ?? null, result.externalAccountLabel ?? null, result.metadata ? JSON.stringify(result.metadata) : null, now, existing.id)
    return existing.id
  }

  const id = await nextStaffIntegrationId()
  await db.prepare(`
    INSERT INTO staff_integrations (id, staff_id, provider, access_token, refresh_token, token_expires_at, scope, external_account_id, external_account_label, metadata, connected_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, staffId, provider, encryptedAccessToken, encryptedRefreshToken, result.expiresAt ?? null, result.scope ?? null, result.externalAccountId ?? null, result.externalAccountLabel ?? null, result.metadata ? JSON.stringify(result.metadata) : null, now, now)
  return id
}

export async function deleteStaffIntegration(staffId: string, provider: IntegrationProvider) {
  await ensureDb()
  const db = useDatabase()
  await db.prepare('DELETE FROM staff_integrations WHERE staff_id = ? AND provider = ?').run(staffId, provider)
}
