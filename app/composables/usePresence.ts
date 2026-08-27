import type { PresenceState, StaffPresence } from '~/types/presence'

export interface PresencePatch {
  override?: 'auto' | 'in_meeting' | 'offline'
  statusText?: string | null
  statusEmoji?: string | null
  statusExpiresAt?: string | null
}

export function usePresence() {
  const presences = useState<Map<string, StaffPresence>>('staff-presences', () => new Map())
  const myOverride = useState<PresenceState | 'auto'>('my-presence-override', () => 'auto')

  async function fetchPresences() {
    const { presences: rows } = await $fetch<{ presences: StaffPresence[] }>('/api/presence')
    presences.value = new Map(rows.map(p => [p.staffId, p]))
  }

  async function sendHeartbeat() {
    await $fetch('/api/presence/heartbeat', { method: 'POST' })
  }

  async function updateMyPresence(patch: PresencePatch) {
    const { presence } = await $fetch<{ presence: StaffPresence }>('/api/presence/me', { method: 'PATCH', body: patch })
    presences.value.set(presence.staffId, presence)
    if (patch.override)
      myOverride.value = patch.override
    return presence
  }

  function getPresence(staffId: string | undefined): StaffPresence | undefined {
    if (!staffId)
      return undefined
    return presences.value.get(staffId)
  }

  return { presences, myOverride, fetchPresences, sendHeartbeat, updateMyPresence, getPresence }
}
