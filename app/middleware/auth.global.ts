const PUBLIC_PATHS = new Set([
  '/portal',
  '/login',
  '/login-basic',
  '/register',
  '/forgot-password',
  '/otp',
  '/otp-1',
  '/otp-2',
  '/401',
  '/403',
  '/404',
  '/500',
  '/503',
])

export default defineNuxtRouteMiddleware(async (to) => {
  // /docs is the public API reference (Scalar) — external developers need it without an account.
  if (PUBLIC_PATHS.has(to.path) || to.path.startsWith('/invite/') || to.path.startsWith('/reset-password/') || to.path === '/docs' || to.path.startsWith('/docs/'))
    return

  const { isLoggedIn, ensureAuth } = useAuth()
  await ensureAuth()

  if (!isLoggedIn.value)
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
})
