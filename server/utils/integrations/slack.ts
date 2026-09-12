interface SlackConversationsOpenResponse {
  ok: boolean
  error?: string
  channel?: { id: string }
}

interface SlackPostMessageResponse {
  ok: boolean
  error?: string
}

function trimTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url
}

function toAbsoluteUrl(path?: string): string | undefined {
  if (!path)
    return undefined
  if (/^https?:\/\//.test(path))
    return path
  const config = useRuntimeConfig()
  return `${trimTrailingSlash(config.siteUrl)}${path.startsWith('/') ? '' : '/'}${path}`
}

/**
 * DMs the connected Slack account for a staff member, if they have one. Failures (revoked token,
 * rate limit, no connection) are swallowed by the caller (createNotification) so Slack can never
 * break the primary in-app/push notification flow.
 */
export async function sendSlackDmToStaff(staffId: string, message: { title: string, body: string, url?: string }): Promise<boolean> {
  const connection = await getDecryptedAccessToken(staffId, 'slack')
  if (!connection || !connection.externalAccountId)
    return false

  const openResponse = await fetch('https://slack.com/api/conversations.open', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${connection.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ users: connection.externalAccountId }),
  })
  const openData = await openResponse.json() as SlackConversationsOpenResponse
  if (!openData.ok || !openData.channel?.id) {
    console.error('[slack] conversations.open failed', openData.error)
    return false
  }

  const link = toAbsoluteUrl(message.url)
  const text = [`*${message.title}*`, message.body, link].filter(Boolean).join('\n')

  const postResponse = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${connection.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel: openData.channel.id, text }),
  })
  const postData = await postResponse.json() as SlackPostMessageResponse
  if (!postData.ok) {
    console.error('[slack] chat.postMessage failed', postData.error)
    return false
  }

  return true
}
