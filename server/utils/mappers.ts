import type { StaffMember } from '../../app/types/staff'
import type { Ticket, TicketReply } from '../../app/types/ticket'

export interface StaffRow {
  id: string
  name: string
  email: string
  role: string
  status: string
  on_call: number
  password_hash: string | null
  invite_token: string | null
  invite_expires_at: string | null
  created_at: string
}

export function mapStaffRow(row: StaffRow): StaffMember {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as StaffMember['role'],
    status: row.status as StaffMember['status'],
    onCall: !!row.on_call,
    createdAt: row.created_at,
  }
}

export interface TicketRow {
  id: string
  subject: string
  description: string
  requester: string
  requester_email: string
  category: string
  status: string
  priority: string
  reference_number: string | null
  attachments: string | null
  created_at: string
}

export function mapTicketRow(row: TicketRow, replies: TicketReply[] = []): Ticket {
  return {
    id: row.id,
    subject: row.subject,
    description: row.description,
    requester: row.requester,
    requesterEmail: row.requester_email,
    category: row.category,
    status: row.status as Ticket['status'],
    priority: row.priority as Ticket['priority'],
    referenceNumber: row.reference_number ?? undefined,
    attachments: row.attachments ? JSON.parse(row.attachments) : [],
    createdAt: row.created_at,
    replies,
  }
}

export interface ReplyRow {
  id: string
  ticket_id: string
  author: string
  message: string
  created_at: string
}

export function mapReplyRow(row: ReplyRow): TicketReply {
  return {
    id: row.id,
    author: row.author,
    message: row.message,
    createdAt: row.created_at,
  }
}

export interface PageRow {
  id: string
  ticket_id: string
  ticket_subject: string
  staff_id: string
  staff_name: string
  created_at: string
  acknowledged: number
}
