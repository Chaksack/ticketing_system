import type { TicketRow } from './mappers'
import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import { OAuth2Client } from 'google-auth-library'

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'
const MESSAGE_ID_DOMAIN = 'ibsgh.com'

let cachedClient: OAuth2Client | null = null

function getOAuthClient(): OAuth2Client {
  const config = useRuntimeConfig()

  if (!config.gmailClientId || !config.gmailClientSecret || !config.gmailRefreshToken) {
    throw new Error('Gmail API is not configured — set NUXT_GMAIL_CLIENT_ID, NUXT_GMAIL_CLIENT_SECRET and NUXT_GMAIL_REFRESH_TOKEN')
  }

  if (!cachedClient) {
    cachedClient = new OAuth2Client(config.gmailClientId, config.gmailClientSecret)
    cachedClient.setCredentials({ refresh_token: config.gmailRefreshToken })
  }

  return cachedClient
}

async function getAccessToken(): Promise<string> {
  const { token } = await getOAuthClient().getAccessToken()
  if (!token)
    throw new Error('Failed to obtain a Gmail access token — the refresh token may be invalid or revoked')
  return token
}

interface GmailApiError extends Error {
  status?: number
}

async function gmailGet(accessToken: string, path: string): Promise<any> {
  const response = await fetch(`${GMAIL_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    const body = await response.text()
    const error = new Error(`Gmail API GET ${path} failed (${response.status}): ${body}`) as GmailApiError
    error.status = response.status
    throw error
  }

  return response.json()
}

async function gmailModify(accessToken: string, messageId: string, body: { removeLabelIds?: string[] }) {
  const response = await fetch(`${GMAIL_API_BASE}/messages/${messageId}/modify`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok)
    console.error(`[gmail] Failed to modify message ${messageId}: ${response.status}`)
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

function buildMimeMessage(options: {
  from: string
  fromName: string
  to: string
  subject: string
  html: string
  messageId: string
  inReplyTo?: string
}): string {
  const body = Buffer.from(options.html, 'utf8').toString('base64').replace(/(.{76})/g, '$1\r\n')

  const headers = [
    `From: "${options.fromName}" <${options.from}>`,
    `To: ${options.to}`,
    `Subject: ${encodeHeaderValue(options.subject)}`,
    `Message-ID: <${options.messageId}>`,
    options.inReplyTo ? `In-Reply-To: <${options.inReplyTo}>` : undefined,
    options.inReplyTo ? `References: <${options.inReplyTo}>` : undefined,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
  ].filter(Boolean).join('\r\n')

  return `${headers}\r\n\r\n${body}`
}

/**
 * Sends an email through the configured Gmail mailbox. Every message gets a Message-ID
 * shaped "ticket-<ticketId>.<random>@ibsgh.com" when `ticketId` is given, so an eventual
 * reply's In-Reply-To/References headers can be matched back to the ticket by
 * `extractTicketIdFromThreadHeaders` — see `server/utils/emailReply.ts`.
 */
export async function sendGmailMessage(options: { to: string, subject: string, html: string, ticketId?: string }): Promise<void> {
  const config = useRuntimeConfig()
  const accessToken = await getAccessToken()

  const messageId = `${options.ticketId ? `ticket-${options.ticketId}.` : ''}${randomUUID()}@${MESSAGE_ID_DOMAIN}`

  const raw = buildMimeMessage({
    from: config.gmailSender,
    fromName: config.gmailFromName,
    to: options.to,
    subject: options.subject,
    html: options.html,
    messageId,
  })

  const response = await fetch(`${GMAIL_API_BASE}/messages/send`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: toBase64Url(raw) }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Gmail send failed (${response.status}): ${body}`)
  }
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

function extractMessageBody(payload: GmailPart): string {
  return findPartBody(payload, 'text/plain')
    ?? (findPartBody(payload, 'text/html') ? htmlToPlainText(findPartBody(payload, 'text/html')!) : '')
}

/**
 * Processes one inbound Gmail message: matches it to a ticket (via thread headers, falling
 * back to the subject), and if matched, appends it as a customer reply — reopening the
 * ticket if it had been resolved/closed, same behavior the old Resend-based webhook had.
 * Returns true if the message was matched and handled (used to decide whether to mark it read).
 */
async function processInboundGmailMessage(accessToken: string, messageId: string): Promise<boolean> {
  const message = await gmailGet(accessToken, `/messages/${messageId}?format=full`)

  const headerList = message.payload?.headers ?? []
  const headers = Object.fromEntries(headerList.map((h: { name: string, value: string }) => [h.name.toLowerCase(), h.value]))

  const threadHeaders = `${headers['in-reply-to'] ?? ''} ${headers.references ?? ''}`
  const ticketId = extractTicketIdFromThreadHeaders(threadHeaders) ?? extractTicketIdFromSubject(headers.subject ?? '')

  if (!ticketId)
    return false

  const db = useDatabase()
  const ticket = await db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId) as TicketRow | undefined
  if (!ticket) {
    console.warn(`[gmail] Reply matched unknown ticket ${ticketId}`)
    return false
  }

  const rawBody = extractMessageBody(message.payload ?? {})
  const cleanMessage = stripQuotedReply(rawBody).trim()
  if (!cleanMessage) {
    console.warn(`[gmail] Empty message body for ticket ${ticketId}, skipping`)
    return true
  }

  const replyId = await nextReplyId()
  const now = new Date().toISOString()

  await db.prepare(`
    INSERT INTO ticket_replies (id, ticket_id, author, message, created_at, internal, author_id, author_type)
    VALUES (?, ?, ?, ?, ?, 0, NULL, 'customer')
  `).run(replyId, ticketId, ticket.requester, cleanMessage, now)

  if (ticket.status === 'resolved' || ticket.status === 'closed') {
    await db.prepare('UPDATE tickets SET status = \'open\', updated_at = ? WHERE id = ?').run(now, ticketId)
    await logTicketActivity({
      ticketId,
      type: 'status_changed',
      actorName: ticket.requester,
      fromValue: ticket.status === 'resolved' ? 'Resolved' : 'Closed',
      toValue: 'Open',
      message: 'Reopened by customer reply',
    })
  }
  else {
    await touchTicket(ticketId)
  }

  if (ticket.assignee_id) {
    await sendPushToStaff(ticket.assignee_id, {
      title: 'New customer reply',
      body: `${ticketId}: ${ticket.subject}`,
      url: '/tickets',
    })
  }

  return true
}

/**
 * Polls the configured Gmail inbox for messages added since the last check, using Gmail's
 * incremental history API (cheap — only fetches deltas, not the whole mailbox each time).
 * The sync cursor is persisted in `integration_state` so it survives across serverless
 * invocations. Call this from a scheduler (Vercel Cron in production, the setInterval sweep
 * in dev) — see `server/api/cron/gmail-inbound.get.ts`.
 */
export async function checkGmailInbox(): Promise<{ processed: number }> {
  const accessToken = await getAccessToken()
  const db = useDatabase()

  const state = await db.prepare('SELECT value FROM integration_state WHERE key = ?').get('gmail_history_id') as { value: string } | undefined

  if (!state) {
    const profile = await gmailGet(accessToken, '/profile')
    await db.prepare('INSERT INTO integration_state (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value')
      .run('gmail_history_id', String(profile.historyId))
    return { processed: 0 }
  }

  let history: any
  try {
    history = await gmailGet(accessToken, `/history?startHistoryId=${state.value}&historyTypes=messageAdded&labelId=INBOX`)
  }
  catch (error) {
    if ((error as GmailApiError).status === 404) {
      // startHistoryId too old (Gmail only retains ~1 week of history) — resync the baseline
      const profile = await gmailGet(accessToken, '/profile')
      await db.prepare('UPDATE integration_state SET value = ? WHERE key = ?').run(String(profile.historyId), 'gmail_history_id')
      return { processed: 0 }
    }
    throw error
  }

  const messageIds = new Set<string>()
  for (const entry of history.history ?? []) {
    for (const added of entry.messagesAdded ?? []) {
      const labelIds: string[] = added.message?.labelIds ?? []
      if (labelIds.includes('INBOX') && !labelIds.includes('SENT'))
        messageIds.add(added.message.id)
    }
  }

  let processed = 0
  for (const id of messageIds) {
    try {
      const handled = await processInboundGmailMessage(accessToken, id)
      if (handled) {
        processed++
        await gmailModify(accessToken, id, { removeLabelIds: ['UNREAD'] })
      }
    }
    catch (error) {
      console.error(`[gmail] Failed to process message ${id}`, error)
    }
  }

  if (history.historyId)
    await db.prepare('UPDATE integration_state SET value = ? WHERE key = ?').run(String(history.historyId), 'gmail_history_id')

  return { processed }
}
