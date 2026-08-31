export default defineNuxtRouteMiddleware(() => {
  const { isAgent, isAdmin, isEngineer, isEngineeringCoordinator, isEngineeringLead } = useAuth()

  if (!isAgent.value && !isAdmin.value && !isEngineer.value && !isEngineeringCoordinator.value && !isEngineeringLead.value)
    return navigateTo('/403')
})
