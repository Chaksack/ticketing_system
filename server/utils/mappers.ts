import type { AmcContract, AmcPlan } from '../../app/types/amc'
import type { Assignee } from '../../app/types/assignee'
import type { Macro } from '../../app/types/automation'
import type { Client, ClientActivity } from '../../app/types/client'
import type { Lead, LeadActivity } from '../../app/types/lead'
import type { StaffMember, StaffRole } from '../../app/types/staff'
import type { Task } from '../../app/types/task'
import type { Ticket, TicketActivity, TicketReply, TicketTag } from '../../app/types/ticket'

export interface StaffRow {
  id: string
  name: string
  email: string
  role: string
  roles: string | null
  status: string
  on_call: number
  password_hash: string | null
  invite_token: string | null
  invite_expires_at: string | null
  reset_token: string | null
  reset_expires_at: string | null
  created_at: string
}

export function parseStaffRoles(row: Pick<StaffRow, 'role' | 'roles'>): StaffRole[] {
  return (row.roles ? JSON.parse(row.roles) : [row.role]) as StaffRole[]
}

export function mapStaffRow(row: StaffRow): StaffMember {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    roles: parseStaffRoles(row),
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

export interface ClientRow {
  id: string
  name: string
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  stage: string
  notes: string | null
  assigned_to: string | null
  assigned_to_name?: string | null
  created_at: string
  updated_at: string
}

export function mapClientRow(
  row: ClientRow,
  activity: ClientActivity[] = [],
  contracts: AmcContract[] = [],
): Client {
  return {
    id: row.id,
    name: row.name,
    contactName: row.contact_name ?? undefined,
    contactEmail: row.contact_email ?? undefined,
    contactPhone: row.contact_phone ?? undefined,
    stage: row.stage as Client['stage'],
    notes: row.notes ?? undefined,
    assignedTo: row.assigned_to ?? undefined,
    assignedToName: row.assigned_to_name ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    activity,
    contracts,
  }
}

export interface ClientActivityRow {
  id: string
  client_id: string
  type: string
  actor_id: string | null
  actor_name: string | null
  from_value: string | null
  to_value: string | null
  message: string | null
  created_at: string
}

export function mapClientActivityRow(row: ClientActivityRow): ClientActivity {
  return {
    id: row.id,
    clientId: row.client_id,
    type: row.type as ClientActivity['type'],
    actorId: row.actor_id ?? undefined,
    actorName: row.actor_name ?? undefined,
    fromValue: row.from_value ?? undefined,
    toValue: row.to_value ?? undefined,
    message: row.message ?? undefined,
    createdAt: row.created_at,
  }
}

export interface AmcPlanRow {
  id: string
  name: string
  description: string | null
  default_duration_months: number
  price: number | string | null
  created_at: string
}

export function mapAmcPlanRow(row: AmcPlanRow): AmcPlan {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    defaultDurationMonths: row.default_duration_months,
    price: row.price === null ? undefined : Number(row.price),
    createdAt: row.created_at,
  }
}

export interface ContractRow {
  id: string
  client_id: string
  plan_id: string
  plan_name?: string | null
  start_date: string
  end_date: string
  status: string
  reminder_30d_sent: number
  reminder_7d_sent: number
  created_at: string
}

export function mapContractRow(row: ContractRow): AmcContract {
  return {
    id: row.id,
    clientId: row.client_id,
    planId: row.plan_id,
    planName: row.plan_name ?? undefined,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status as AmcContract['status'],
    reminder30dSent: !!row.reminder_30d_sent,
    reminder7dSent: !!row.reminder_7d_sent,
    createdAt: row.created_at,
  }
}

export interface LeadRow {
  id: string
  name: string
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  source: string | null
  stage: string
  notes: string | null
  converted_client_id: string | null
  next_step: string | null
  next_step_at: string | null
  next_step_reminder_sent: number
  created_at: string
  updated_at: string
}

export function mapLeadRow(row: LeadRow, activity: LeadActivity[] = [], assignees: Assignee[] = []): Lead {
  return {
    id: row.id,
    name: row.name,
    contactName: row.contact_name ?? undefined,
    contactEmail: row.contact_email ?? undefined,
    contactPhone: row.contact_phone ?? undefined,
    source: row.source ?? undefined,
    stage: row.stage as Lead['stage'],
    notes: row.notes ?? undefined,
    assignees,
    convertedClientId: row.converted_client_id ?? undefined,
    nextStep: row.next_step ?? undefined,
    nextStepAt: row.next_step_at ?? undefined,
    nextStepReminderSent: !!row.next_step_reminder_sent,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    activity,
  }
}

export interface LeadActivityRow {
  id: string
  lead_id: string
  type: string
  actor_id: string | null
  actor_name: string | null
  from_value: string | null
  to_value: string | null
  message: string | null
  created_at: string
}

export function mapLeadActivityRow(row: LeadActivityRow): LeadActivity {
  return {
    id: row.id,
    leadId: row.lead_id,
    type: row.type as LeadActivity['type'],
    actorId: row.actor_id ?? undefined,
    actorName: row.actor_name ?? undefined,
    fromValue: row.from_value ?? undefined,
    toValue: row.to_value ?? undefined,
    message: row.message ?? undefined,
    createdAt: row.created_at,
  }
}

export interface TaskRow {
  id: string
  type: string
  title: string
  description: string | null
  status: string
  priority: string
  color: string | null
  epic_id: string | null
  epic_title?: string | null
  epic_color?: string | null
  parent_task_id: string | null
  start_date: string | null
  due_date: string | null
  remind_at: string | null
  reminder_sent: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export function mapTaskRow(row: TaskRow, assignees: Assignee[] = []): Task {
  return {
    id: row.id,
    type: row.type as Task['type'],
    title: row.title,
    description: row.description ?? undefined,
    status: row.status as Task['status'],
    priority: row.priority as Task['priority'],
    color: row.color ?? undefined,
    assignees,
    epicId: row.epic_id ?? undefined,
    epicTitle: row.epic_title ?? undefined,
    epicColor: row.epic_color ?? undefined,
    parentTaskId: row.parent_task_id ?? undefined,
    startDate: row.start_date ?? undefined,
    dueDate: row.due_date ?? undefined,
    remindAt: row.remind_at ?? undefined,
    reminderSent: !!row.reminder_sent,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
