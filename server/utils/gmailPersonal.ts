import { Buffer } from 'node:buffer'
import { OAuth2Client } from 'google-auth-library'

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'

function getPersonalOAuthClient(refreshToken: string): OAuth2Client {
  const config = useRuntimeConfig()

  if (!config.gmailClientId || !config.gmailClientSecret) {
    throw new Error('Gmail API is not configured — set NUXT_GMAIL_CLIENT_ID and NUXT_GMAIL_CLIENT_SECRET')
  }

  const client = new OAuth2Client(config.gmailClientId, config.gmailClientSecret)
  client.setCredentials({ refresh_token: refreshToken })
  return client
}

export async function requireConnectedGmailAccount(staffId: string): Promise<{ gmailEmail: string, refreshToken: string }> {
  await ensureDb()
  const db = useDatabase()

  const row = await db.prepare('SELECT gmail_email, gmail_refresh_token FROM staff WHERE id = ?').get(staffId) as { gmail_email: string | null, gmail_refresh_token: string | null } | undefined

  if (!row?.gmail_email || !row.gmail_refresh_token) {
    throw createError({ statusCode: 400, statusMessage: 'Connect your Gmail account first' })
  }

  return { gmailEmail: row.gmail_email, refreshToken: row.gmail_refresh_token }
}

export async function getPersonalAccessToken(refreshToken: string): Promise<string> {
  const { token } = await getPersonalOAuthClient(refreshToken).getAccessToken()
  if (!token)
    throw new Error('Failed to refresh your Gmail access token — please reconnect your Gmail account')
  return token
}

function toBase64Url(input: string): string {
  return Buffer.from(input, 'utf8')
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')
}

function fromBase64Url(input: string): string {
  return Buffer.from(input.replaceAll('-', '+').replaceAll('_', '/'), 'base64').toString('utf8')
}

function encodeHeaderValue(value: string): string {
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`
}

async function gmailFetch(accessToken: string, path: string, init?: RequestInit): Promise<any> {
  const response = await fetch(`${GMAIL_API_BASE}${path}`, {
    ...init,
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Gmail API ${path} failed (${response.status}): ${body}`)
  }

  return response.json()
}

export async function fetchGmailProfile(accessToken: string): Promise<{ emailAddress: string }> {
  return await gmailFetch(accessToken, '/profile')
}

export interface GmailMessageSummary {
  id: string
  threadId: string
  name: string
  email: string
  subject: string
  text: string
  date: string
  read: boolean
  labels: string[]
}

function parseFromHeader(value: string | undefined): { name: string, email: string } {
  if (!value)
    return { name: 'Unknown', email: '' }

  const match = value.match(/^([^<]*)<([^>]+)>$/)
  if (match)
    return { name: match[1]?.replace(/"/g, '').trim() || match[2]!, email: match[2]! }

  return { name: value, email: value }
}

export async function listGmailMessages(accessToken: string, options: { maxResults?: number, query?: string } = {}): Promise<GmailMessageSummary[]> {
  const params = new URLSearchParams({ maxResults: String(options.maxResults ?? 25) })
  params.set('q', options.query ?? 'in:inbox')

  const list = await gmailFetch(accessToken, `/messages?${params}`) as { messages?: { id: string, threadId: string }[] }
  if (!list.messages?.length)
    return []

  const summaries: GmailMessageSummary[] = []
  for (const item of list.messages) {
    const message = await gmailFetch(accessToken, `/messages/${item.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`) as {
      id: string
      threadId: string
      snippet?: string
      labelIds?: string[]
      internalDate: string
      payload?: { headers?: { name: string, value: string }[] }
    }

    const headers = Object.fromEntries((message.payload?.headers ?? []).map(h => [h.name.toLowerCase(), h.value]))
    const { name, email } = parseFromHeader(headers.from)

    summaries.push({
      id: message.id,
      threadId: message.threadId,
      name,
      email,
      subject: headers.subject ?? '(no subject)',
      text: message.snippet ?? '',
      date: new Date(Number(message.internalDate)).toISOString(),
      read: !(message.labelIds ?? []).includes('UNREAD'),
      labels: (message.labelIds ?? [])
        .filter(label => !['INBOX', 'UNREAD', 'SENT', 'IMPORTANT'].includes(label) && !label.startsWith('CATEGORY_'))
        .map(label => label.replace(/^Label_/, '').toLowerCase()),
    })
  }

  return summaries
}

interface GmailPart {
  mimeType?: string
  body?: { data?: string }
  parts?: GmailPart[]
}

function findPartBody(part: GmailPart, mimeType: string): string | undefined {
  if (part.mimeType === mimeType && part.body?.data)
    return fromBase64Url(part.body.data)

  for (const child of part.parts ?? []) {
    const found = findPartBody(child, mimeType)
    if (found)
      return found
  }

  return undefined
}

export interface GmailMessageDetail {
  text: string
  messageIdHeader?: string
  from?: string
  to?: string
  cc?: string
}

export async function getGmailMessageBody(accessToken: string, messageId: string): Promise<GmailMessageDetail> {
  const message = await gmailFetch(accessToken, `/messages/${messageId}?format=full`) as { payload?: GmailPart & { headers?: { name: string, value: string }[] } }
  const headers = Object.fromEntries((message.payload?.headers ?? []).map(h => [h.name.toLowerCase(), h.value]))

  const text = message.payload ? (findPartBody(message.payload, 'text/plain') ?? findPartBody(message.payload, 'text/html') ?? '') : ''
  return {
    text,
    messageIdHeader: headers['message-id'],
    from: headers.from,
    to: headers.to,
    cc: headers.cc,
  }
}

export async function modifyGmailMessage(accessToken: string, messageId: string, options: { addLabelIds?: string[], removeLabelIds?: string[] }): Promise<void> {
  await gmailFetch(accessToken, `/messages/${messageId}/modify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  })
}

export async function trashGmailMessage(accessToken: string, messageId: string): Promise<void> {
  await gmailFetch(accessToken, `/messages/${messageId}/trash`, { method: 'POST' })
}

export async function sendGmailFromPersonalAccount(accessToken: string, options: {
  fromEmail: string
  to: string
  subject: string
  text: string
  inReplyToMessageId?: string
  threadId?: string
}): Promise<void> {
  const headers = [
    `From: ${options.fromEmail}`,
    `To: ${options.to}`,
    `Subject: ${encodeHeaderValue(options.subject)}`,
    options.inReplyToMessageId ? `In-Reply-To: ${options.inReplyToMessageId}` : undefined,
    options.inReplyToMessageId ? `References: ${options.inReplyToMessageId}` : undefined,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
  ].filter(Boolean).join('\r\n')

  const raw = `${headers}\r\n\r\n${options.text}`

  const body: Record<string, string> = { raw: toBase64Url(raw) }
  if (options.threadId)
    body.threadId = options.threadId

  await gmailFetch(accessToken, '/messages/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
