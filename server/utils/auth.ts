import type { H3Event } from 'h3'
import type { StaffRole } from '../../app/types/staff'

export interface SessionUser {
  id: string
  name: string
  email: string
  roles: StaffRole[]
  avatarUrl?: string
}

interface SessionData {
  user?: SessionUser
  /** CSRF nonce for the in-progress personal-Gmail OAuth connect flow, cleared once used. */
  gmailOAuthState?: string
}

export function useAuthSession(event: H3Event) {
  const config = useRuntimeConfig()

  return useSession<SessionData>(event, {
    password: config.sessionPassword,
    name: 'ibs_session',
    maxAge: 60 * 60 * 24 * 7,
  })
}

export async function getSessionUser(event: H3Event): Promise<SessionUser | null> {
  const session = await useAuthSession(event)
  return session.data.user ?? null
}

export async function requireSessionUser(event: H3Event): Promise<SessionUser> {
  const user = await getSessionUser(event)

  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  return user
}

export async function requireAdmin(event: H3Event): Promise<SessionUser> {
  const user = await requireSessionUser(event)

  if (!user.roles.includes('admin')) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  return user
}

/** Gates the BD & SM area — bd and sm hold identical access here, alongside admin. */
export async function requireBd(event: H3Event): Promise<SessionUser> {
  const user = await requireSessionUser(event)

  if (!user.roles.includes('bd') && !user.roles.includes('sm') && !user.roles.includes('admin')) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  return user
}

export async function requireAgent(event: H3Event): Promise<SessionUser> {
  const user = await requireSessionUser(event)

  if (!user.roles.includes('agent') && !user.roles.includes('admin')) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  return user
}
