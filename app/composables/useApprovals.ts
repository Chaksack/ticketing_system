import type { ApprovalRequest } from '~/types/approval'

export function useApprovals() {
  const approvals = useState<ApprovalRequest[]>('approvals-list', () => [])

  async function fetchApprovals() {
    const { approvals: rows } = await $fetch<{ approvals: ApprovalRequest[] }>('/api/approvals')
    approvals.value = rows
  }

  function replaceApproval(approval: ApprovalRequest) {
    const index = approvals.value.findIndex(a => a.id === approval.id)
    if (index !== -1)
      approvals.value[index] = approval
  }

  async function approve(id: string, notes?: string) {
    const { approval } = await $fetch<{ approval: ApprovalRequest }>(`/api/approvals/${id}/approve`, { method: 'POST', body: { notes } })
    replaceApproval(approval)
    return approval
  }

  async function reject(id: string, notes?: string) {
    const { approval } = await $fetch<{ approval: ApprovalRequest }>(`/api/approvals/${id}/reject`, { method: 'POST', body: { notes } })
    replaceApproval(approval)
    return approval
  }

  return { approvals, fetchApprovals, approve, reject }
}
