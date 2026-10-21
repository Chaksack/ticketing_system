import type { NavGroup, NavLink, NavMenu, NavSectionTitle } from '~/types/nav'
import type { OrgApp } from '~/types/organization'
import { hqMenu, navMenu } from '~/constants/menus'

/**
 * Which app (chosen per company at sign-up, editable under Admin → Organisation) each page
 * belongs to. Pages not listed — calendar, email, chat, admin, settings — are always available.
 */
const APP_BY_PATH: [prefix: string, app: OrgApp][] = [
  ['/tickets', 'service'],
  ['/inbox', 'service'],
  ['/knowledge', 'service'],
  ['/reports', 'service'],
  ['/admin/automations', 'service'],
  ['/admin/sla', 'service'],
  ['/admin/macros', 'service'],
  ['/overview', 'sales'],
  ['/pipeline', 'sales'],
  ['/leads', 'sales'],
  ['/tenders', 'sales'],
  ['/clients', 'sales'],
  ['/bd-reports', 'sales'],
  ['/admin/bd-automations', 'sales'],
  ['/admin/bd-quotas', 'sales'],
  ['/admin/products', 'sales'],
  ['/projects', 'projects'],
  ['/tasks', 'projects'],
  ['/sprints', 'projects'],
  ['/amc-plans', 'projects'],
  ['/timesheets', 'projects'],
  ['/resource-utilization', 'projects'],
  ['/executive-dashboard', 'insights'],
  ['/field', 'field'],
  ['/marketing', 'marketing'],
]

export function appForPath(path: string): OrgApp | undefined {
  return APP_BY_PATH.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`))?.[1]
}

export interface NavVisibilityContext {
  /** The company's enabled apps; undefined = no company loaded yet (show everything). */
  apps?: OrgApp[]
  isPlatformStaff?: boolean
  /** Signed in to Canopy's own workspace (any role). */
  isHomeOrg?: boolean
}

export function isNavItemVisible(item: NavLink | NavGroup | NavSectionTitle, isAdmin: boolean, userRoles: string[], context: NavVisibilityContext = {}) {
  if ('platformOnly' in item && item.platformOnly && !context.isPlatformStaff)
    return false

  if ('homeOnly' in item && item.homeOnly && !context.isHomeOrg)
    return false

  if ('adminOnly' in item && item.adminOnly && !isAdmin)
    return false

  if ('link' in item && context.apps) {
    const app = appForPath(item.link)
    if (app && !context.apps.includes(app))
      return false
  }

  if ('roles' in item && item.roles?.length && !isAdmin) {
    if (!item.roles.some(role => userRoles.includes(role)))
      return false
  }

  return true
}

/** Flat list of every nav link (across all headings) the current user can actually see. */
export function useVisibleNavLinks() {
  const { currentUser, currentOrg, isAdmin, isPlatformStaff } = useAuth()

  return computed<NavLink[]>(() => {
    const userRoles = currentUser.value?.roles ?? []
    const context = { apps: currentOrg.value?.apps, isPlatformStaff: isPlatformStaff.value, isHomeOrg: !!currentOrg.value?.isHome }

    const seen = new Set<string>()
    return ([...navMenu, ...hqMenu] as NavMenu[])
      .flatMap(group => group.items)
      .filter((item): item is NavLink => 'link' in item)
      // "My work" repeats in every area — list each page once.
      .filter(item => !seen.has(item.link) && !!seen.add(item.link))
      .filter(item => isNavItemVisible(item, isAdmin.value, userRoles, context))
  })
}
