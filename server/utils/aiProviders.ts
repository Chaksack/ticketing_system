import type { AiProvider, AiProviderStatus, AiSettings } from '../../app/types/ai-provider'
import { OAuth2Client } from 'google-auth-library'
import { AI_PROVIDERS } from '../../app/types/ai-provider'

/**
 * Each staff member's own AI provider for "Ask AI". Gemini connects with Google sign-in (OAuth
 * refresh token); OpenAI and Anthropic don't offer sign-in to third-party apps, so those take the
 * person's own API key. Either way the secret is encrypted at rest in staff_integrations
 * (provider = "ai:<id>"), the same table and encryption as Slack.
 */

// Google sign-in for Gemini: identify the account + call the Gemini API on the user's behalf.
export const GEMINI_OAUTH_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/generative-language.retriever',
]

interface AiIntegrationRow {
  provider: string
  access_token: string | null
  refresh_token: string | null
  external_account_label: string | null
  connected_at: string
}

const rowKey = (provider: AiProvider) => `ai:${provider}`

/** Gemini sign-in reuses the Google OAuth client already configured for Gmail. */
export function isGeminiSignInConfigured() {
  const config = useRuntimeConfig()
  return !!(config.gmailClientId && config.gmailClientSecret)
}

export function geminiOAuthClient(redirectUri?: string) {
  const config = useRuntimeConfig()
  return new OAuth2Client(config.gmailClientId, config.gmailClientSecret, redirectUri)
}

async function loadRows(staffId: string): Promise<AiIntegrationRow[]> {
  const db = useDatabase()
  return await db.prepare(`
    SELECT provider, access_token, refresh_token, external_account_label, connected_at
    FROM staff_integrations WHERE staff_id = ? AND provider LIKE 'ai:%'
  `).all(staffId) as AiIntegrationRow[]
}

export async function getAiSettings(staffId: string): Promise<AiSettings> {
  const db = useDatabase()
  const rows = await loadRows(staffId)
  const staff = await db.prepare('SELECT ai_provider FROM staff WHERE id = ?').get(staffId) as { ai_provider: string | null } | undefined
  const preferred = AI_PROVIDERS.some(p => p.id === staff?.ai_provider) ? staff!.ai_provider as AiProvider : null

  const providers: AiProviderStatus[] = AI_PROVIDERS.map((p) => {
    const row = rows.find(r => r.provider === rowKey(p.id))
    return {
      provider: p.id,
      label: p.label,
      method: p.method,
      connected: !!row,
      accountLabel: row?.external_account_label ?? undefined,
      connectedAt: row?.connected_at ?? undefined,
      available: p.method === 'api_key' || isGeminiSignInConfigured(),
    }
  })

  const activeProvider = pickProvider(providers, preferred)
  const active: AiSettings['active'] = activeProvider
    ? { source: 'personal', provider: activeProvider, label: AI_PROVIDERS.find(p => p.id === activeProvider)!.label }
    : useRuntimeConfig().anthropicApiKey
      ? { source: 'company', provider: 'anthropic', label: 'Company default (Claude)' }
      : { source: 'none', label: 'Built-in answers only (no AI connected)' }

  return { providers, preferred, active }
}

/** The preferred provider if it's connected, otherwise the first connected one (Gemini, then Claude, then ChatGPT). */
function pickProvider(providers: AiProviderStatus[], preferred: AiProvider | null): AiProvider | null {
  if (preferred && providers.find(p => p.provider === preferred)?.connected)
    return preferred
  for (const id of ['gemini', 'anthropic', 'openai'] as AiProvider[]) {
    if (providers.find(p => p.provider === id)?.connected)
      return id
  }
  return null
}

export async function setPreferredAiProvider(staffId: string, provider: AiProvider | null) {
  const db = useDatabase()
  await db.prepare('UPDATE staff SET ai_provider = ? WHERE id = ?').run(provider, staffId)
}

async function upsertAiRow(staffId: string, provider: AiProvider, values: { accessToken?: string, refreshToken?: string, accountLabel: string }) {
  const db = useDatabase()
  const now = new Date().toISOString()
  const access = values.accessToken ? encryptSecret(values.accessToken) : null
  const refresh = values.refreshToken ? encryptSecret(values.refreshToken) : null

  const existing = await db.prepare('SELECT id FROM staff_integrations WHERE staff_id = ? AND provider = ?').get(staffId, rowKey(provider)) as { id: string } | undefined
  if (existing) {
    await db.prepare(`
      UPDATE staff_integrations SET access_token = ?, refresh_token = ?, external_account_label = ?, updated_at = ? WHERE id = ?
    `).run(access, refresh, values.accountLabel, now, existing.id)
    return
  }
  await db.prepare(`
    INSERT INTO staff_integrations (id, staff_id, provider, access_token, refresh_token, external_account_label, connected_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(await nextStaffIntegrationId(), staffId, rowKey(provider), access, refresh, values.accountLabel, now, now)
}

export async function saveGeminiConnection(staffId: string, refreshToken: string, email: string) {
  await upsertAiRow(staffId, 'gemini', { refreshToken, accountLabel: email })
}

function maskKey(key: string) {
  return `${key.slice(0, key.startsWith('sk-ant-') ? 7 : 3)}…${key.slice(-4)}`
}

/**
 * Checks the key with a cheap read-only call to the provider before storing it, so a typo is
 * caught at save time rather than the first time someone asks the assistant something.
 */
async function verifyApiKey(provider: 'openai' | 'anthropic', key: string) {
  const request = provider === 'openai'
    ? fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${key}` } })
    : fetch('https://api.anthropic.com/v1/models', { headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' } })

  let response: Response
  try {
    response = await request
  }
  catch {
    throw createError({ statusCode: 502, statusMessage: 'Could not reach the provider to check that key. Please try again.' })
  }
  if (response.status === 401 || response.status === 403)
    throw createError({ statusCode: 400, statusMessage: 'That API key was rejected by the provider. Check it and try again.' })
  if (!response.ok)
    throw createError({ statusCode: 502, statusMessage: `The provider returned an error checking that key (HTTP ${response.status}).` })
}

export async function saveAiApiKey(staffId: string, provider: 'openai' | 'anthropic', key: string) {
  const trimmed = key.trim()
  if (trimmed.length < 20)
    throw createError({ statusCode: 400, statusMessage: 'That doesn\'t look like a complete API key.' })
  await verifyApiKey(provider, trimmed)
  await upsertAiRow(staffId, provider, { accessToken: trimmed, accountLabel: maskKey(trimmed) })
}

export async function removeAiProvider(staffId: string, provider: AiProvider) {
  const db = useDatabase()
  const row = await db.prepare('SELECT refresh_token FROM staff_integrations WHERE staff_id = ? AND provider = ?').get(staffId, rowKey(provider)) as { refresh_token: string | null } | undefined

  // Best-effort: also revoke Google's grant so the app no longer appears under the person's Google account.
  if (provider === 'gemini' && row?.refresh_token)
    await geminiOAuthClient().revokeToken(decryptSecret(row.refresh_token)).catch(() => {})

  await db.prepare('DELETE FROM staff_integrations WHERE staff_id = ? AND provider = ?').run(staffId, rowKey(provider))
}

export type AiCredentials
  = | { provider: 'gemini', source: 'personal', label: string, accessToken: string }
    | { provider: 'openai' | 'anthropic', source: 'personal' | 'company', label: string, apiKey: string }

/** What "Ask AI" should call for this person, with a ready-to-use credential — or null for the built-in fallback. */
export async function resolveAiCredentials(staffId: string): Promise<AiCredentials | null> {
  const settings = await getAiSettings(staffId)
  const { active } = settings

  if (active.source === 'company')
    return { provider: 'anthropic', source: 'company', label: 'Claude', apiKey: useRuntimeConfig().anthropicApiKey }
  if (active.source !== 'personal' || !active.provider)
    return null

  const row = (await loadRows(staffId)).find(r => r.provider === rowKey(active.provider!))
  if (!row)
    return null

  if (active.provider === 'gemini') {
    if (!row.refresh_token)
      return null
    const client = geminiOAuthClient()
    client.setCredentials({ refresh_token: decryptSecret(row.refresh_token) })
    try {
      const { token } = await client.getAccessToken()
      if (!token)
        throw new Error('no access token')
      return { provider: 'gemini', source: 'personal', label: 'Gemini', accessToken: token }
    }
    catch {
      throw createError({ statusCode: 401, statusMessage: 'Your Google sign-in for Gemini has expired or was revoked. Reconnect it in Settings → Integrations.' })
    }
  }

  if (!row.access_token)
    return null
  return {
    provider: active.provider,
    source: 'personal',
    label: active.provider === 'openai' ? 'ChatGPT' : 'Claude',
    apiKey: decryptSecret(row.access_token),
  }
}
