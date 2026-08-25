export default defineNuxtRouteMiddleware(() => {
  const { isBd, isAdmin } = useAuth()

  if (!isBd.value && !isAdmin.value)
    return navigateTo('/403')
})
