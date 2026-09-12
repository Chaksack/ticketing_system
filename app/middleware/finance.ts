export default defineNuxtRouteMiddleware(() => {
  const { isFinance, isAdmin } = useAuth()

  if (!isFinance.value && !isAdmin.value)
    return navigateTo('/403')
})
