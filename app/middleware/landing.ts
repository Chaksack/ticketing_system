// The public landing page (/) is for visitors; signed-in staff go straight to their own start page.
// A named middleware (not inline in definePageMeta) so Nuxt keeps its context across the await.
export default defineNuxtRouteMiddleware(async () => {
  const { ensureAuth, isLoggedIn, homePath } = useAuth()
  await ensureAuth()
  if (isLoggedIn.value)
    return navigateTo(homePath.value)
})
