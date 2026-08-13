/**
 * One-time helper to generate a Gmail OAuth2 refresh token so the app can send
 * invite emails via the Gmail REST API (works on Vercel; SMTP does not).
 *
 * Prerequisites (do this once in Google Cloud Console, https://console.cloud.google.com):
 *   1. Create or select a project.
 *   2. APIs & Services > Library > enable "Gmail API".
 *   3. APIs & Services > OAuth consent screen:
 *        - User type: External, Publishing status: Testing is fine.
 *        - Add app.ibsgh@gmail.com under "Test users".
 *   4. APIs & Services > Credentials > Create Credentials > OAuth client ID:
 *        - Application type: "Desktop app".
 *      Copy the Client ID and Client Secret it gives you.
 *
 * Usage:
 *   NUXT_GMAIL_CLIENT_ID=... NUXT_GMAIL_CLIENT_SECRET=... node scripts/gmail-oauth-setup.mjs
 *   (or set them in .env first — this script reads .env automatically)
 *
 * It opens a browser tab for you to sign in as app.ibsgh@gmail.com, then prints
 * the refresh token to paste into .env (locally) and your Vercel project's
 * environment variables (for production).
 */

import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import process from 'node:process'
import { OAuth2Client } from 'google-auth-library'

function loadDotEnv() {
  try {
    const content = readFileSync(new URL('../.env', import.meta.url), 'utf8')
    for (const line of content.split('\n')) {
      const match = line.match(/^([\w.]+)=(.*)$/)
      if (match && !process.env[match[1]])
        process.env[match[1]] = match[2].trim()
    }
  }
  catch {
    // no .env file yet — that's fine, rely on process.env
  }
}

loadDotEnv()

const clientId = process.env.NUXT_GMAIL_CLIENT_ID
const clientSecret = process.env.NUXT_GMAIL_CLIENT_SECRET
const port = 3939
const redirectUri = `http://localhost:${port}/oauth2callback`

if (!clientId || !clientSecret) {
  console.error('Missing NUXT_GMAIL_CLIENT_ID / NUXT_GMAIL_CLIENT_SECRET.')
  console.error('Set them in .env or as env vars before running this script.')
  process.exit(1)
}

const client = new OAuth2Client(clientId, clientSecret, redirectUri)

const authUrl = client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/gmail.send'],
})

console.warn('\nOpen this URL, sign in as app.ibsgh@gmail.com, and approve access:\n')
console.warn(authUrl)
console.warn(`\nWaiting for the redirect on ${redirectUri} ...\n`)

const server = createServer(async (req, res) => {
  if (!req.url?.startsWith('/oauth2callback'))
    return res.end('OK')

  const url = new URL(req.url, redirectUri)
  const code = url.searchParams.get('code')

  if (!code) {
    res.end('No authorization code received. Check the terminal and try again.')
    return
  }

  res.end('Success — you can close this tab and return to the terminal.')

  const { tokens } = await client.getToken(code)

  console.warn('\nRefresh token obtained. Add these to .env and your Vercel project settings:\n')
  console.warn(`NUXT_GMAIL_CLIENT_ID=${clientId}`)
  console.warn(`NUXT_GMAIL_CLIENT_SECRET=${clientSecret}`)
  console.warn(`NUXT_GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`)
  console.warn('')

  server.close()
  process.exit(0)
})

server.listen(port)
