import { OAuth2Client } from 'google-auth-library'

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)

  const query = getQuery(event)
  const code = typeof query.code === 'string' ? query.code : null
  const state = typeof query.state === 'string' ? query.state : null

  const session = await useAuthSession(event)
  const expectedState = session.data.gmailOAuthState
  await session.update({ ...session.data, gmailOAuthState: undefined })

  if (query.error) {
    return sendRedirect(event, `/email?gmail_error=${encodeURIComponent(String(query.error))}`)
  }

  if (!code || !state || !expectedState || state !== expectedState) {
    return sendRedirect(event, '/email?gmail_error=invalid_state')
  }

  const config = useRuntimeConfig()
  if (!config.gmailClientId || !config.gmailClientSecret) {
    throw createError({ statusCode: 500, statusMessage: 'Gmail API is not configured on this server' })
  }

  const origin = getRequestURL(event).origin
  const redirectUri = `${origin}/api/integrations/gmail/callback`

  const client = new OAuth2Client(config.gmailClientId, config.gmailClientSecret, redirectUri)

  try {
    const { tokens } = await client.getToken(code)
    if (!tokens.refresh_token) {
      return sendRedirect(event, '/email?gmail_error=no_refresh_token')
    }

    const profile = await fetchGmailProfile(tokens.access_token!)

    await ensureDb()
    const db = useDatabase()
    await db.prepare('UPDATE staff SET gmail_email = ?, gmail_refresh_token = ?, gmail_connected_at = ? WHERE id = ?')
      .run(profile.emailAddress, tokens.refresh_token, new Date().toISOString(), user.id)

    return sendRedirect(event, '/email?connected=1')
  }
  catch (error) {
    console.error('[gmail] Failed to complete personal OAuth connection', error)
    return sendRedirect(event, '/email?gmail_error=exchange_failed')
  }
})
