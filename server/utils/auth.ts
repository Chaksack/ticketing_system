import type { H3Event } from 'h3'
import type { StaffRole } from '../../app/types/staff'
import type { StaffRow } from './mappers'

export interface SessionUser {
  id: string
  name: string
  email: string
  roles: StaffRole[]
  avatarUrl?: string
}

interface SessionData {
  user?: SessionUser
  /** When this session signed in. Sessions older than staff.password_changed_at are rejected. */
  authAt?: string
  /** CSRF nonce for the in-progress personal-Gmail OAuth connect flow, cleared once used. */
  gmailOAuthState?: string
  /** CSRF nonce + provider id for the in-progress Settings > Integrations OAuth connect flow, cleared once used. */
  integrationOAuthState?: string
  integrationOAuthProvider?: string
  /** CSRF nonce for the in-progress "Connect Gemini with Google" flow, cleared once used. */
  aiGeminiOAuthState?: string
}

export function useAuthSession(event: H3Event) {
  const config = useRuntimeConfig()

  return useSession<SessionData>(event, {
    password: config.sessionPassword,
    name: 'ibs_session',
    maxAge: 60 * 60 * 24 * 7,
  })
}

// Re-derives roles/status from the staff table on every call instead of trusting the session
// cookie's snapshot — otherwise an admin changing someone's roles (or disabling them) has no
// effect until that person logs out and back in.
export async function getSessionUser(event: H3Event): Promise<SessionUser | null> {
  const session = await useAuthSession(event)
  const sessionUser = session.data.user
  if (!sessionUser) {
    return null
  }

  await ensureDb()
  const db = useDatabase()
  const row = await db.prepare('SELECT * FROM staff WHERE id = ?').get(sessionUser.id) as StaffRow | undefined

  if (!row || row.status === 'disabled') {
    return null
  }

  // Password changed (reset by an admin, or by the person on another device) since this session
  // signed in → it's no longer valid. Sessions from before this check existed have no authAt.
  if (row.password_changed_at && (!session.data.authAt || session.data.authAt < row.password_changed_at)) {
    return null
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    roles: parseStaffRoles(row),
    avatarUrl: row.avatar_url ?? undefined,
  }
}

/** Signs `user` in on this request's session, stamped with the sign-in time (see getSessionUser). */
export async function startUserSession(event: H3Event, user: SessionUser, authAt = new Date().toISOString()) {
  const session = await useAuthSession(event)
  await session.update({ user, authAt })
}

/**
 * Stores a new password hash and records the change time, which invalidates every existing
 * session for that person. Returns the timestamp so the caller can keep its own session valid.
 */
export async function setStaffPassword(staffId: string, password: string): Promise<string> {
  const db = useDatabase()
  const changedAt = new Date().toISOString()
  await db.prepare(`
    UPDATE staff SET password_hash = ?, password_changed_at = ?, reset_token = NULL, reset_expires_at = NULL WHERE id = ?
  `).run(hashPassword(password), changedAt, staffId)
  return changedAt
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

/** Gates the product catalog — a BD/SM + Finance shared concern. */
export async function requireBilling(event: H3Event): Promise<SessionUser> {
  const user = await requireSessionUser(event)

  if (!user.roles.includes('bd') && !user.roles.includes('sm') && !user.roles.includes('finance') && !user.roles.includes('admin')) {
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

/** True for admin, finance, and engineering leadership — the roles allowed to see other staff members' logged time. */
export function isCapacityViewer(user: SessionUser): boolean {
  return user.roles.includes('admin') || user.roles.includes('finance') || user.roles.includes('engineering_lead') || user.roles.includes('engineering_coordinator')
}

/** Gates cross-staff time/capacity visibility (the resource utilization view, and reading other people's timesheets) — admin, finance, and engineering leadership. */
export async function requireCapacityView(event: H3Event): Promise<SessionUser> {
  const user = await requireSessionUser(event)

  if (!isCapacityViewer(user)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  return user
}

/** Gates engineering-only areas — engineer, engineering_coordinator, and engineering_lead hold identical access here, alongside admin. */
export async function requireEngineer(event: H3Event): Promise<SessionUser> {
  const user = await requireSessionUser(event)

  if (!user.roles.includes('engineer') && !user.roles.includes('engineering_coordinator') && !user.roles.includes('engineering_lead') && !user.roles.includes('admin')) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  return user
}
