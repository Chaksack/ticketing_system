export default defineNuxtRouteMiddleware(() => {
  const { isBd, isSm, isFinance, isAdmin } = useAuth()

  if (!isBd.value && !isSm.value && !isFinance.value && !isAdmin.value)
    return navigateTo('/403')
})
