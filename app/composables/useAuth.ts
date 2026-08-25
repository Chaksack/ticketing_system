import type { StaffRole } from '~/types/staff'

export interface AuthUser {
  id: string
  name: string
  email: string
  roles: StaffRole[]
}

export function useAuth() {
  const currentUser = useState<AuthUser | null>('current-user', () => null)
  const authReady = useState('auth-ready', () => false)
  const requestFetch = useRequestFetch()

  const isAdmin = computed(() => currentUser.value?.roles.includes('admin') ?? false)
  const isAgent = computed(() => currentUser.value?.roles.includes('agent') ?? false)
  const isBd = computed(() => currentUser.value?.roles.includes('bd') ?? false)
  const isSm = computed(() => currentUser.value?.roles.includes('sm') ?? false)
  const isLoggedIn = computed(() => !!currentUser.value)

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

  async function login(email: string, password: string) {
    const { user } = await $fetch('/api/auth/login', {
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

  return { currentUser, authReady, isAdmin, isAgent, isBd, isSm, isLoggedIn, ensureAuth, login, logout }
}
