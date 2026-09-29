import type { StaffMember, StaffRole, StaffStatus } from '~/types/staff'

export function useStaff() {
  const staff = useState<StaffMember[]>('staff-list', () => [])

  const onCallStaff = computed(() => staff.value.filter(s => s.onCall && s.status === 'active'))

  async function fetchStaff() {
    const { staff: rows } = await $fetch('/api/staff')
    staff.value = rows
  }

  function getStaff(id: string) {
    return staff.value.find(s => s.id === id)
  }

  async function addStaff(payload: { name: string, email: string, roles: StaffRole[] }) {
    const result = await $fetch('/api/staff', { method: 'POST', body: payload })
    staff.value.unshift(result.staff)
    return result
  }

  async function updateStatus(id: string, status: StaffStatus) {
    const { staff: updated } = await $fetch<{ staff: StaffMember }>(`/api/staff/${id}`, { method: 'PATCH', body: { status } })
    const index = staff.value.findIndex(s => s.id === id)
    if (index !== -1)
      staff.value[index] = updated
  }

  async function setOnCall(id: string, onCall: boolean) {
    const { staff: updated } = await $fetch<{ staff: StaffMember }>(`/api/staff/${id}`, { method: 'PATCH', body: { onCall } })
    const index = staff.value.findIndex(s => s.id === id)
    if (index !== -1)
      staff.value[index] = updated
  }

  async function updateRoles(id: string, roles: StaffRole[]) {
    const { staff: updated } = await $fetch<{ staff: StaffMember }>(`/api/staff/${id}`, { method: 'PATCH', body: { roles } })
    const index = staff.value.findIndex(s => s.id === id)
    if (index !== -1)
      staff.value[index] = updated
  }

  async function updateManager(id: string, managerId: string | null) {
    const { staff: updated } = await $fetch<{ staff: StaffMember }>(`/api/staff/${id}`, { method: 'PATCH', body: { managerId } })
    const index = staff.value.findIndex(s => s.id === id)
    if (index !== -1)
      staff.value[index] = updated
  }

  async function updateHourlyRate(id: string, hourlyRate: number | null) {
    const { staff: updated } = await $fetch<{ staff: StaffMember }>(`/api/staff/${id}`, { method: 'PATCH', body: { hourlyRate } })
    const index = staff.value.findIndex(s => s.id === id)
    if (index !== -1)
      staff.value[index] = updated
  }

  /** Admin only: emails the person a link to choose a new password (returned as resetUrl if the email couldn't be sent). */
  async function sendPasswordResetLink(id: string) {
    return await $fetch<{ emailSent: boolean, email: string, expiresAt: string, resetUrl?: string }>(`/api/staff/${id}/reset-password`, { method: 'POST' })
  }

  async function removeStaff(id: string) {
    await $fetch(`/api/staff/${id}`, { method: 'DELETE' })
    staff.value = staff.value.filter(s => s.id !== id)
  }

  return { staff, onCallStaff, fetchStaff, getStaff, addStaff, updateStatus, setOnCall, updateRoles, updateManager, updateHourlyRate, sendPasswordResetLink, removeStaff }
}
