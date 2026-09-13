import type { ApprovalRequest, ApprovalStatus } from '../../app/types/approval'
import type { NewInvoiceInput } from './invoices'
import { createInvoiceForClient } from './invoices'
import { markSalesOrderInvoiced } from './salesOrders'

export interface ApprovalRequestRow {
  id: string
  type: string
  subject_label: string
  payload: string
  status: string
  requested_by: string | null
  requested_by_name?: string | null
  requested_at: string
  decided_by: string | null
  decided_by_name?: string | null
  decided_at: string | null
  decision_notes: string | null
  result_id: string | null
  created_at: string
}

export function mapApprovalRequestRow(row: ApprovalRequestRow): ApprovalRequest {
  return {
    id: row.id,
    type: row.type,
    subjectLabel: row.subject_label,
    status: row.status as ApprovalStatus,
    requestedBy: row.requested_by ?? undefined,
    requestedByName: row.requested_by_name ?? undefined,
    requestedAt: row.requested_at,
    decidedBy: row.decided_by ?? undefined,
    decidedByName: row.decided_by_name ?? undefined,
    decidedAt: row.decided_at ?? undefined,
    decisionNotes: row.decision_notes ?? undefined,
    resultId: row.result_id ?? undefined,
    createdAt: row.created_at,
  }
}

const SELECT_APPROVAL = `
  SELECT approval_requests.*,
    requester.name AS requested_by_name,
    decider.name AS decided_by_name
  FROM approval_requests
  LEFT JOIN staff AS requester ON requester.id = approval_requests.requested_by
  LEFT JOIN staff AS decider ON decider.id = approval_requests.decided_by
`

export async function getAllApprovals(): Promise<ApprovalRequest[]> {
  const db = useDatabase()
  const rows = await db.prepare(`${SELECT_APPROVAL} ORDER BY approval_requests.requested_at DESC`).all() as ApprovalRequestRow[]
  return rows.map(mapApprovalRequestRow)
}

export async function getApprovalById(id: string): Promise<ApprovalRequest | undefined> {
  const db = useDatabase()
  const row = await db.prepare(`${SELECT_APPROVAL} WHERE approval_requests.id = ?`).get(id) as ApprovalRequestRow | undefined
  return row ? mapApprovalRequestRow(row) : undefined
}

export interface NewApprovalRequest {
  type: string
  subjectLabel: string
  payload: unknown
  requestedBy: string
}

export async function createApprovalRequest(input: NewApprovalRequest): Promise<ApprovalRequest> {
  const db = useDatabase()
  const id = await nextApprovalRequestId()
  const now = new Date().toISOString()

  await db.prepare(`
    INSERT INTO approval_requests (id, type, subject_label, payload, status, requested_by, requested_at, created_at)
    VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)
  `).run(id, input.type, input.subjectLabel, JSON.stringify(input.payload), input.requestedBy, now, now)

  return (await getApprovalById(id))!
}

interface InvoiceDiscountPayload {
  clientId: string
  invoicePayload: NewInvoiceInput
  requestedBy: string
  requestedByName: string
  salesOrderId?: string
}

/**
 * One entry per approval type — adding a future kind (an expense, a write-off) is exactly one
 * new handler here, nothing else in the approval pipeline changes.
 */
const APPROVAL_HANDLERS: Record<string, (payload: any) => Promise<{ resultId: string }>> = {
  invoice_discount: async (payload: InvoiceDiscountPayload) => {
    const { invoice } = await createInvoiceForClient(payload.clientId, payload.invoicePayload, { id: payload.requestedBy, name: payload.requestedByName })
    if (payload.salesOrderId)
      await markSalesOrderInvoiced(payload.salesOrderId)
    return { resultId: invoice.id }
  },
}

export async function decideApproval(id: string, decision: 'approved' | 'rejected', decidedBy: string, notes?: string): Promise<ApprovalRequest> {
  const db = useDatabase()

  const existing = await getApprovalById(id)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Approval request not found' })
  }
  if (existing.status !== 'pending') {
    throw createError({ statusCode: 409, statusMessage: `This request was already ${existing.status}` })
  }

  let resultId: string | undefined
  if (decision === 'approved') {
    const handler = APPROVAL_HANDLERS[existing.type]
    if (!handler) {
      throw createError({ statusCode: 400, statusMessage: `No handler registered for approval type: ${existing.type}` })
    }
    const row = await db.prepare('SELECT payload FROM approval_requests WHERE id = ?').get(id) as { payload: string }
    const result = await handler(JSON.parse(row.payload))
    resultId = result.resultId
  }

  await db.prepare(`
    UPDATE approval_requests SET status = ?, decided_by = ?, decided_at = ?, decision_notes = ?, result_id = ? WHERE id = ?
  `).run(decision, decidedBy, new Date().toISOString(), notes?.trim() || null, resultId ?? null, id)

  return (await getApprovalById(id))!
}
