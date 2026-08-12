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

  async function addStaff(payload: { name: string, email: string, role: StaffRole }) {
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

  async function removeStaff(id: string) {
    await $fetch(`/api/staff/${id}`, { method: 'DELETE' })
    staff.value = staff.value.filter(s => s.id !== id)
  }

  return { staff, onCallStaff, fetchStaff, getStaff, addStaff, updateStatus, setOnCall, removeStaff }
}
