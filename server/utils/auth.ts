import type { H3Event } from 'h3'
import type { StaffRole } from '../../app/types/staff'

export interface SessionUser {
  id: string
  name: string
  email: string
  role: StaffRole
}

interface SessionData {
  user?: SessionUser
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

  if (user.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  return user
}
