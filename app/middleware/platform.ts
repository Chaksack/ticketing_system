// Canopy staff console — admins of Canopy's own (home) workspace only.
export default defineNuxtRouteMiddleware(() => {
  const { isPlatformStaff } = useAuth()
  if (!isPlatformStaff.value)
    return navigateTo('/403')
})
