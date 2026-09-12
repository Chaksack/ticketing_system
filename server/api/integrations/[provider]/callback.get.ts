export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)

  const providerId = getRouterParam(event, 'provider')
  const provider = getProviderConfig(providerId)
  if (!provider) {
    throw createError({ statusCode: 404, statusMessage: 'Unknown integration' })
  }

  const query = getQuery(event)
  const code = typeof query.code === 'string' ? query.code : null
  const state = typeof query.state === 'string' ? query.state : null

  const session = await useAuthSession(event)
  const expectedState = session.data.integrationOAuthState
  const expectedProvider = session.data.integrationOAuthProvider
  await session.update({ ...session.data, integrationOAuthState: undefined, integrationOAuthProvider: undefined })

  const redirectTo = (status: 'connected' | 'error', message?: string) =>
    sendRedirect(event, `/settings/integrations?${status === 'connected' ? `connected=${provider.id}` : `integration_error=${encodeURIComponent(message ?? 'unknown_error')}`}`)

  if (query.error) {
    return redirectTo('error', String(query.error))
  }
  if (!code || !state || !expectedState || state !== expectedState || expectedProvider !== provider.id) {
    return redirectTo('error', 'invalid_state')
  }
  if (!provider.clientId() || !provider.clientSecret()) {
    throw createError({ statusCode: 500, statusMessage: `${provider.label} is not configured on this server` })
  }

  const origin = getRequestURL(event).origin
  const redirectUri = `${origin}/api/integrations/${provider.id}/callback`

  try {
    const result = await provider.exchangeCode({ code, redirectUri, clientId: provider.clientId(), clientSecret: provider.clientSecret() })
    await upsertStaffIntegration(user.id, provider.id, result)
    return redirectTo('connected')
  }
  catch (error) {
    console.error(`[integrations] Failed to complete ${provider.id} OAuth connection`, error)
    return redirectTo('error', 'exchange_failed')
  }
})
