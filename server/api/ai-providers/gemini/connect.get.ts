import { randomBytes } from 'node:crypto'

// "Connect with Google" for Gemini — reuses the Google OAuth client already configured for Gmail.
export default defineEventHandler(async (event) => {
  await requireSessionUser(event)

  if (!isGeminiSignInConfigured()) {
    throw createError({ statusCode: 500, statusMessage: 'Google sign-in is not configured on this server' })
  }

  // Built from the incoming request so localhost, previews and production each work, as long as
  // this exact callback URL is registered on the Google OAuth client.
  const redirectUri = `${getRequestURL(event).origin}/api/ai-providers/gemini/callback`

  const state = randomBytes(16).toString('hex')
  const session = await useAuthSession(event)
  await session.update({ ...session.data, aiGeminiOAuthState: state })

  const authUrl = geminiOAuthClient(redirectUri).generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: false,
    scope: GEMINI_OAUTH_SCOPES,
    state,
  })

  return sendRedirect(event, authUrl)
})
