/**
 * Companion to gmail-oauth-setup.mjs for when the redirect URI is a live domain
 * (e.g. the production Vercel deployment) instead of localhost — there's no server here to
 * catch the redirect automatically, so this takes the `code` query param from the URL the
 * browser landed on (even a 404 page still shows it) and exchanges it manually.
 *
 * Usage:
 *   node scripts/gmail-oauth-exchange.mjs <code> <redirect_uri>
 */

import { readFileSync } from 'node:fs'
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

const code = process.argv[2]
const redirectUri = process.argv[3]

if (!code || !redirectUri) {
  console.error('Usage: node scripts/gmail-oauth-exchange.mjs <code> <redirect_uri>')
  process.exit(1)
}

const clientId = process.env.NUXT_GMAIL_CLIENT_ID
const clientSecret = process.env.NUXT_GMAIL_CLIENT_SECRET

if (!clientId || !clientSecret) {
  console.error('Missing NUXT_GMAIL_CLIENT_ID / NUXT_GMAIL_CLIENT_SECRET.')
  process.exit(1)
}

const client = new OAuth2Client(clientId, clientSecret, redirectUri)

const { tokens } = await client.getToken(code)

console.warn('\nRefresh token obtained. Add this to .env and your Vercel project settings:\n')
console.warn(`NUXT_GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`)
console.warn('')
