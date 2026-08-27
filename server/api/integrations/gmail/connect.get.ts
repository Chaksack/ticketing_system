import { randomBytes } from 'node:crypto'
import { OAuth2Client } from 'google-auth-library'

export default defineEventHandler(async (event) => {
  await requireSessionUser(event)

  const config = useRuntimeConfig()
  if (!config.gmailClientId || !config.gmailClientSecret) {
    throw createError({ statusCode: 500, statusMessage: 'Gmail API is not configured on this server' })
  }

  // Built from the actual incoming request, not NUXT_SITE_URL, so this works correctly whether
  // you're on localhost, a preview deployment, or production — each just needs its own redirect
  // URI registered as authorized in Google Cloud Console.
  const origin = getRequestURL(event).origin
  const redirectUri = `${origin}/api/integrations/gmail/callback`

  const state = randomBytes(16).toString('hex')
  const session = await useAuthSession(event)
  await session.update({ ...session.data, gmailOAuthState: state })

  const client = new OAuth2Client(config.gmailClientId, config.gmailClientSecret, redirectUri)
  const authUrl = client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/gmail.modify'],
    state,
  })

  return sendRedirect(event, authUrl)
})
