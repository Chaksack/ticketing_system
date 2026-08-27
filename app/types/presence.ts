export type PresenceState = 'online' | 'away' | 'in_meeting' | 'offline'

export interface StaffPresence {
  staffId: string
  state: PresenceState
  statusText?: string
  statusEmoji?: string
}
