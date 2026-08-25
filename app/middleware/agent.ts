export default defineNuxtRouteMiddleware(() => {
  const { isAgent, isAdmin } = useAuth()

  if (!isAgent.value && !isAdmin.value)
    return navigateTo('/403')
})
