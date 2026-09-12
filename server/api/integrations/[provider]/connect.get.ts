import { randomBytes } from 'node:crypto'

export default defineEventHandler(async (event) => {
  await requireSessionUser(event)

  const providerId = getRouterParam(event, 'provider')
  const provider = getProviderConfig(providerId)
  if (!provider) {
    throw createError({ statusCode: 404, statusMessage: 'Unknown integration' })
  }
  if (!provider.clientId() || !provider.clientSecret()) {
    throw createError({ statusCode: 500, statusMessage: `${provider.label} is not configured on this server` })
  }

  // Built from the actual incoming request, not NUXT_SITE_URL, so this works whether you're on
  // localhost, a preview deployment, or production — each just needs its own redirect URI
  // registered as authorized in that provider's app settings.
  const origin = getRequestURL(event).origin
  const redirectUri = `${origin}/api/integrations/${provider.id}/callback`

  const state = randomBytes(16).toString('hex')
  const session = await useAuthSession(event)
  await session.update({ ...session.data, integrationOAuthState: state, integrationOAuthProvider: provider.id })

  const authUrl = new URL(provider.authorizeUrl)
  authUrl.searchParams.set('client_id', provider.clientId())
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('scope', provider.scope)
  authUrl.searchParams.set('state', state)

  return sendRedirect(event, authUrl.toString())
})
