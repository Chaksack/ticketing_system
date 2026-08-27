export type PresenceState = 'online' | 'away' | 'in_meeting' | 'offline'

export interface StaffPresence {
  staffId: string
  state: PresenceState
  statusText?: string
  statusEmoji?: string
}

const ONLINE_WINDOW_MS = 2 * 60 * 1000
const AWAY_WINDOW_MS = 10 * 60 * 1000

export interface PresenceRow {
  id: string
  last_active_at: string | null
  presence_override: string
  status_text: string | null
  status_emoji: string | null
  status_expires_at: string | null
}

export function derivePresenceState(row: Pick<PresenceRow, 'last_active_at' | 'presence_override'>): PresenceState {
  if (row.presence_override === 'offline')
    return 'offline'
  if (row.presence_override === 'in_meeting')
    return 'in_meeting'

  if (!row.last_active_at)
    return 'offline'

  const elapsed = Date.now() - new Date(row.last_active_at).getTime()
  if (elapsed < ONLINE_WINDOW_MS)
    return 'online'
  if (elapsed < AWAY_WINDOW_MS)
    return 'away'
  return 'offline'
}

export function mapPresenceRow(row: PresenceRow): StaffPresence {
  const statusExpired = !!row.status_expires_at && new Date(row.status_expires_at).getTime() < Date.now()

  return {
    staffId: row.id,
    state: derivePresenceState(row),
    statusText: statusExpired ? undefined : (row.status_text ?? undefined),
    statusEmoji: statusExpired ? undefined : (row.status_emoji ?? undefined),
  }
}
