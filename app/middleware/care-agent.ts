// Canopy Care agent desktop — anyone in Canopy's own workspace; the API checks they're assigned to a client.
export default defineNuxtRouteMiddleware(() => {
  const { currentOrg } = useAuth()
  if (!currentOrg.value?.isHome)
    return navigateTo('/403')
})
