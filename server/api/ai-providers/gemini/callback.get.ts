export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)

  const query = getQuery(event)
  const code = typeof query.code === 'string' ? query.code : null
  const state = typeof query.state === 'string' ? query.state : null

  const session = await useAuthSession(event)
  const expectedState = session.data.aiGeminiOAuthState
  await session.update({ ...session.data, aiGeminiOAuthState: undefined })

  const done = (params: string) => sendRedirect(event, `/settings/integrations?${params}`)

  if (query.error)
    return done(`ai_error=${encodeURIComponent(String(query.error))}`)
  if (!code || !state || !expectedState || state !== expectedState)
    return done('ai_error=invalid_state')

  const redirectUri = `${getRequestURL(event).origin}/api/ai-providers/gemini/callback`
  const client = geminiOAuthClient(redirectUri)

  try {
    const { tokens } = await client.getToken(code)
    if (!tokens.refresh_token)
      return done('ai_error=no_refresh_token')

    // The person might untick the Gemini permission on Google's consent screen.
    if (!tokens.scope?.includes('generative-language'))
      return done('ai_error=missing_gemini_permission')

    const ticket = await client.verifyIdToken({ idToken: tokens.id_token!, audience: useRuntimeConfig().gmailClientId })
    const email = ticket.getPayload()?.email ?? 'Google account'

    await ensureDb()
    await saveGeminiConnection(user.id, tokens.refresh_token, email)
    return done('ai_connected=gemini')
  }
  catch (error) {
    console.error('[ai-providers] Failed to complete Gemini Google sign-in', error)
    return done('ai_error=exchange_failed')
  }
})
