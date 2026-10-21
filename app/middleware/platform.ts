// Canopy HQ admin pages — people given HQ admin access in Canopy HQ → Team.
export default defineNuxtRouteMiddleware(() => {
  const { isPlatformStaff } = useAuth()
  if (!isPlatformStaff.value)
    return navigateTo('/403')
})
