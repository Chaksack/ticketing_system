import { Buffer } from 'node:buffer'
import { OAuth2Client } from 'google-auth-library'

let oauthClient: OAuth2Client | null = null

function getOAuthClient() {
  if (!oauthClient) {
    const config = useRuntimeConfig()
    oauthClient = new OAuth2Client(config.gmailClientId, config.gmailClientSecret)
    oauthClient.setCredentials({ refresh_token: config.gmailRefreshToken })
  }

  return oauthClient
}

async function getAccessToken(): Promise<string> {
  const client = getOAuthClient()
  const { token } = await client.getAccessToken()

  if (!token)
    throw new Error('Failed to obtain a Gmail access token — check NUXT_GMAIL_CLIENT_ID/SECRET/REFRESH_TOKEN.')

  return token
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function encodeSubject(subject: string): string {
  return `=?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`
}

function buildRawMessage(params: { from: string, to: string, subject: string, html: string }): string {
  const message = [
    `From: ${params.from}`,
    `To: ${params.to}`,
    `Subject: ${encodeSubject(params.subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    params.html,
  ].join('\r\n')

  return base64UrlEncode(message)
}

export async function sendMail(options: { to: string, subject: string, html: string }) {
  const config = useRuntimeConfig()
  const accessToken = await getAccessToken()

  const raw = buildRawMessage({
    from: `"IBS Ticketing System" <${config.gmailUser}>`,
    to: options.to,
    subject: options.subject,
    html: options.html,
  })

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Gmail API send failed (${response.status}): ${body}`)
  }
}

export async function sendStaffInviteEmail(params: { to: string, name: string, token: string }) {
  const config = useRuntimeConfig()
  const link = `${config.siteUrl.replace(/\/+$/, '')}/invite/${params.token}`

  await sendMail({
    to: params.to,
    subject: 'You\'ve been invited to IBS Ticketing System',
    html: `
      <p>Hi ${params.name},</p>
      <p>You've been added as staff on IBS Ticketing System. Click the link below to create your password and get started:</p>
      <p><a href="${link}">${link}</a></p>
      <p>This link expires in 48 hours. If you weren't expecting this, you can ignore this email.</p>
    `,
  })
}

export async function sendPasswordResetEmail(params: { to: string, name: string, token: string }) {
  const config = useRuntimeConfig()
  const link = `${config.siteUrl.replace(/\/+$/, '')}/reset-password/${params.token}`

  await sendMail({
    to: params.to,
    subject: 'Reset your IBS Ticketing System password',
    html: `
      <p>Hi ${params.name},</p>
      <p>We received a request to reset your password. Click the link below to choose a new one:</p>
      <p><a href="${link}">${link}</a></p>
      <p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
    `,
  })
}
