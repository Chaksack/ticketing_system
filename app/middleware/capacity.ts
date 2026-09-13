export default defineNuxtRouteMiddleware(() => {
  const { isAdmin, isFinance, isEngineeringLead, isEngineeringCoordinator } = useAuth()

  if (!isAdmin.value && !isFinance.value && !isEngineeringLead.value && !isEngineeringCoordinator.value)
    return navigateTo('/403')
})
