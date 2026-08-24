import type { Macro } from '../../app/types/automation'
import type { StaffMember } from '../../app/types/staff'
import type { Ticket, TicketActivity, TicketReply, TicketTag } from '../../app/types/ticket'

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
  reset_token: string | null
  reset_expires_at: string | null
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
  updated_at: string | null
  assignee_id: string | null
  assignee_name?: string | null
  due_at: string | null
  first_response_due_at: string | null
  first_response_at: string | null
  resolved_at: string | null
  closed_at: string | null
  sla_escalated: number
}

export function mapTicketRow(
  row: TicketRow,
  replies: TicketReply[] = [],
  activity: TicketActivity[] = [],
  tags: TicketTag[] = [],
): Ticket {
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
    updatedAt: row.updated_at ?? row.created_at,
    replies,
    activity,
    tags,
    assigneeId: row.assignee_id ?? undefined,
    assigneeName: row.assignee_name ?? undefined,
    dueAt: row.due_at ?? undefined,
    firstResponseDueAt: row.first_response_due_at ?? undefined,
    firstResponseAt: row.first_response_at ?? undefined,
    resolvedAt: row.resolved_at ?? undefined,
    closedAt: row.closed_at ?? undefined,
    slaEscalated: !!row.sla_escalated,
  }
}

export interface ReplyRow {
  id: string
  ticket_id: string
  author: string
  message: string
  created_at: string
  internal: number
  author_id: string | null
  author_type: string
}

export function mapReplyRow(row: ReplyRow): TicketReply {
  return {
    id: row.id,
    author: row.author,
    message: row.message,
    createdAt: row.created_at,
    internal: !!row.internal,
    authorId: row.author_id ?? undefined,
    authorType: row.author_type as TicketReply['authorType'],
  }
}

export interface ActivityRow {
  id: string
  ticket_id: string
  type: string
  actor_id: string | null
  actor_name: string | null
  from_value: string | null
  to_value: string | null
  message: string | null
  created_at: string
}

export function mapActivityRow(row: ActivityRow): TicketActivity {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    type: row.type as TicketActivity['type'],
    actorId: row.actor_id ?? undefined,
    actorName: row.actor_name ?? undefined,
    fromValue: row.from_value ?? undefined,
    toValue: row.to_value ?? undefined,
    message: row.message ?? undefined,
    createdAt: row.created_at,
  }
}

export interface TagRow {
  id: string
  name: string
  color: string
  created_at: string
}

export function mapTagRow(row: TagRow): TicketTag {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
  }
}

export interface MacroRow {
  id: string
  name: string
  body: string
  set_status: string | null
  set_priority: string | null
  add_tag_id: string | null
  created_at: string
}

export function mapMacroRow(row: MacroRow): Macro {
  return {
    id: row.id,
    name: row.name,
    body: row.body,
    setStatus: row.set_status as Macro['setStatus'] ?? undefined,
    setPriority: row.set_priority as Macro['setPriority'] ?? undefined,
    addTagId: row.add_tag_id ?? undefined,
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
