// Canopy HQ pages for anyone with HQ access (HQ admins and Care agents); the API checks which clients.
export default defineNuxtRouteMiddleware(() => {
  const { hasHq } = useAuth()
  if (!hasHq.value)
    return navigateTo('/403')
})
