import type { IntegrationProvider } from '../../../app/types/integration'

export interface NormalizedTokenResult {
  accessToken: string
  refreshToken?: string
  expiresAt?: string
  scope?: string
  externalAccountId?: string
  externalAccountLabel?: string
  metadata?: Record<string, unknown>
}

export interface IntegrationProviderConfig {
  id: IntegrationProvider
  label: string
  authorizeUrl: string
  scope: string
  clientId: () => string
  clientSecret: () => string
  exchangeCode: (params: { code: string, redirectUri: string, clientId: string, clientSecret: string }) => Promise<NormalizedTokenResult>
}

interface SlackOAuthResponse {
  ok: boolean
  error?: string
  access_token?: string
  scope?: string
  bot_user_id?: string
  team?: { id: string, name: string }
  authed_user?: { id: string }
}

async function exchangeSlackCode({ code, redirectUri, clientId, clientSecret }: { code: string, redirectUri: string, clientId: string, clientSecret: string }): Promise<NormalizedTokenResult> {
  const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri })
  const response = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = await response.json() as SlackOAuthResponse

  if (!data.ok || !data.access_token) {
    throw new Error(`Slack OAuth exchange failed: ${data.error ?? 'unknown_error'}`)
  }
  if (!data.authed_user?.id) {
    throw new Error('Slack OAuth exchange did not return the authorizing user\'s id')
  }

  return {
    accessToken: data.access_token,
    scope: data.scope,
    externalAccountId: data.authed_user.id,
    externalAccountLabel: data.team?.name,
    metadata: { teamId: data.team?.id, botUserId: data.bot_user_id },
  }
}

/**
 * One entry per connectable app. Adding a new provider (GitHub, Google Calendar, ...) means adding
 * one entry here plus its own functional integration (e.g. Slack's sendSlackDmToStaff) — the
 * connect/callback/status/disconnect routes are generic and need no changes.
 */
export const INTEGRATION_PROVIDERS: Record<IntegrationProvider, IntegrationProviderConfig> = {
  slack: {
    id: 'slack',
    label: 'Slack',
    authorizeUrl: 'https://slack.com/oauth/v2/authorize',
    // chat:write to post messages, im:write to open a DM channel with the connecting user.
    scope: 'chat:write,im:write',
    clientId: () => useRuntimeConfig().slackClientId,
    clientSecret: () => useRuntimeConfig().slackClientSecret,
    exchangeCode: exchangeSlackCode,
  },
}

export function getProviderConfig(id: string | undefined): IntegrationProviderConfig | undefined {
  if (!id || !(id in INTEGRATION_PROVIDERS))
    return undefined
  return INTEGRATION_PROVIDERS[id as IntegrationProvider]
}
