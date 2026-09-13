export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

export interface ApprovalRequest {
  id: string
  type: string
  subjectLabel: string
  status: ApprovalStatus
  requestedBy?: string
  requestedByName?: string
  requestedAt: string
  decidedBy?: string
  decidedByName?: string
  decidedAt?: string
  decisionNotes?: string
  resultId?: string
  createdAt: string
}
