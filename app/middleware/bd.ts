export default defineNuxtRouteMiddleware(() => {
  const { isBd, isSm, isAdmin } = useAuth()

  if (!isBd.value && !isSm.value && !isAdmin.value)
    return navigateTo('/403')
})
