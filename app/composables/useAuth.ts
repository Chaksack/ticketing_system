import type { OrgApp, OrgPlan } from '~/types/organization'
import type { StaffRole } from '~/types/staff'

export interface AuthOrg {
  id: string
  name: string
  slug: string
  apps: OrgApp[]
  plan: OrgPlan
  sector?: string
  /** Canopy's own workspace — its admins run the staff console. */
  isHome: boolean
}

export interface AuthUser {
  id: string
  name: string
  email: string
  roles: StaffRole[]
  avatarUrl?: string
  org?: AuthOrg | null
}

export function useAuth() {
  const currentUser = useState<AuthUser | null>('current-user', () => null)
  const authReady = useState('auth-ready', () => false)
  const requestFetch = useRequestFetch()

  const isAdmin = computed(() => currentUser.value?.roles.includes('admin') ?? false)
  const isAgent = computed(() => currentUser.value?.roles.includes('agent') ?? false)
  const isBd = computed(() => currentUser.value?.roles.includes('bd') ?? false)
  const isSm = computed(() => currentUser.value?.roles.includes('sm') ?? false)
  const isFinance = computed(() => currentUser.value?.roles.includes('finance') ?? false)
  const isEngineer = computed(() => currentUser.value?.roles.includes('engineer') ?? false)
  const isEngineeringCoordinator = computed(() => currentUser.value?.roles.includes('engineering_coordinator') ?? false)
  const isEngineeringLead = computed(() => currentUser.value?.roles.includes('engineering_lead') ?? false)
  const isLoggedIn = computed(() => !!currentUser.value)
  const currentOrg = computed(() => currentUser.value?.org ?? null)
  /** Canopy staff: admins of the home workspace. */
  const isPlatformStaff = computed(() => !!currentOrg.value?.isHome && isAdmin.value)
  function hasApp(app: OrgApp) {
    return currentOrg.value ? currentOrg.value.apps.includes(app) : true
  }

  async function ensureAuth() {
    if (authReady.value)
      return currentUser.value

    try {
      const { user } = await requestFetch('/api/auth/me')
      currentUser.value = user
    }
    catch {
      currentUser.value = null
    }
    finally {
      authReady.value = true
    }

    return currentUser.value
  }

  /** Start page inside the company workspace (customer service first), from the person's roles. */
  const workspacePath = computed(() => {
    const roles = currentUser.value?.roles ?? []
    const admin = roles.includes('admin')
    if (hasApp('service') && (admin || roles.some(role => role === 'agent' || role === 'engineer' || role === 'engineering_coordinator' || role === 'engineering_lead')))
      return '/tickets'
    if (hasApp('sales') && (admin || roles.some(role => role === 'bd' || role === 'sm')))
      return '/overview'
    if (hasApp('projects') && (admin || roles.includes('finance')))
      return admin ? '/projects' : '/resource-utilization'
    return '/calendar'
  })

  /**
   * Where this person's work starts — used after sign-in and when a signed-in person opens the
   * public landing page at "/". Canopy's own admins start in Canopy HQ; everyone else in their
   * company workspace.
   */
  const homePath = computed(() => currentUser.value?.roles.includes('admin') && currentOrg.value?.isHome ? '/hq' : workspacePath.value)

  async function login(email: string, password: string) {
    const { user } = await fetchUntyped<{ user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    })

    currentUser.value = user
    authReady.value = true

    return user
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    currentUser.value = null
  }

  return { currentUser, currentOrg, authReady, isAdmin, isAgent, isBd, isSm, isFinance, isEngineer, isEngineeringCoordinator, isEngineeringLead, isLoggedIn, isPlatformStaff, hasApp, homePath, workspacePath, ensureAuth, login, logout }
}
