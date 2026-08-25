import type { NavGroup, NavLink, NavMenu, NavSectionTitle } from '~/types/nav'
import { navMenu } from '~/constants/menus'

export function isNavItemVisible(item: NavLink | NavGroup | NavSectionTitle, isAdmin: boolean, userRoles: string[]) {
  if ('adminOnly' in item && item.adminOnly && !isAdmin)
    return false

  if ('roles' in item && item.roles?.length && !isAdmin) {
    if (!item.roles.some(role => userRoles.includes(role)))
      return false
  }

  return true
}

/** Flat list of every nav link (across all headings) the current user can actually see. */
export function useVisibleNavLinks() {
  const { currentUser, isAdmin } = useAuth()

  return computed<NavLink[]>(() => {
    const userRoles = currentUser.value?.roles ?? []

    return (navMenu as NavMenu[])
      .flatMap(group => group.items)
      .filter((item): item is NavLink => 'link' in item)
      .filter(item => isNavItemVisible(item, isAdmin.value, userRoles))
  })
}
