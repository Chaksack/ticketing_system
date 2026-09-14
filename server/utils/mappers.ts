import type { AmcContract, AmcPlan } from '../../app/types/amc'
import type { Assignee } from '../../app/types/assignee'
import type { Macro } from '../../app/types/automation'
import type { Client, ClientActivity, ClientContact, ClientContactEmail, ClientContactPhone, ClientDocument } from '../../app/types/client'
import type { Interaction } from '../../app/types/interaction'
import type { Invoice } from '../../app/types/invoice'
import type { Lead, LeadActivity, LeadContactEmail, LeadContactPhone, LeadDocument } from '../../app/types/lead'
import type { LineItem } from '../../app/types/product'
import type { Project } from '../../app/types/project'
import type { Sprint } from '../../app/types/sprint'
import type { StaffMember, StaffRole } from '../../app/types/staff'
import type { Task } from '../../app/types/task'
import type { Tender, TenderActivity, TenderDocument } from '../../app/types/tender'
import type { Ticket, TicketActivity, TicketAttachment, TicketReply, TicketTag } from '../../app/types/ticket'

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
  avatar_url: string | null
  manager_id?: string | null
  hourly_rate?: number | string | null
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
    avatarUrl: row.avatar_url ?? undefined,
    managerId: row.manager_id ?? undefined,
    hourlyRate: row.hourly_rate ? Number(row.hourly_rate) : undefined,
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
  escalation_level: string | null
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
    // Tickets created before real file upload existed stored attachments as bare filename
    // strings; normalize those to { name } so the type is consistent either way.
    attachments: row.attachments
      ? (JSON.parse(row.attachments) as (string | TicketAttachment)[]).map(entry => typeof entry === 'string' ? { name: entry } : entry)
      : [],
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
    escalationLevel: (row.escalation_level as Ticket['escalationLevel']) ?? undefined,
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
  estimated_value: number | string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export function mapClientRow(
  row: ClientRow,
  activity: ClientActivity[] = [],
  contracts: AmcContract[] = [],
  projects: Project[] = [],
  additionalEmails: ClientContactEmail[] = [],
  additionalPhones: ClientContactPhone[] = [],
  assignees: Assignee[] = [],
  contacts: ClientContact[] = [],
  documents: ClientDocument[] = [],
  interactions: Interaction[] = [],
  invoices: Invoice[] = [],
  balanceByCurrency: { currency: string, balance: number }[] = [],
): Client {
  return {
    id: row.id,
    name: row.name,
    contactName: row.contact_name ?? undefined,
    contactEmail: row.contact_email ?? undefined,
    contactPhone: row.contact_phone ?? undefined,
    additionalEmails,
    additionalPhones,
    contacts,
    documents,
    stage: row.stage as Client['stage'],
    estimatedValue: row.estimated_value !== null ? Number(row.estimated_value) : undefined,
    notes: row.notes ?? undefined,
    assignees,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    activity,
    interactions,
    invoices,
    balanceByCurrency,
    projects,
    contracts,
  }
}

export interface ClientContactEmailRow {
  id: string
  client_id: string
  email: string
  label: string | null
  created_at: string
}

export function mapClientContactEmailRow(row: ClientContactEmailRow): ClientContactEmail {
  return { id: row.id, email: row.email, label: row.label ?? undefined }
}

export interface ClientContactPhoneRow {
  id: string
  client_id: string
  phone: string
  label: string | null
  created_at: string
}

export function mapClientContactPhoneRow(row: ClientContactPhoneRow): ClientContactPhone {
  return { id: row.id, phone: row.phone, label: row.label ?? undefined }
}

export interface ClientContactRow {
  id: string
  client_id: string
  name: string
  title: string | null
  email: string | null
  phone: string | null
  is_primary: number
  notes: string | null
  created_at: string
}

export function mapClientContactRow(row: ClientContactRow): ClientContact {
  return {
    id: row.id,
    name: row.name,
    title: row.title ?? undefined,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    isPrimary: !!row.is_primary,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
  }
}

export interface ProjectRow {
  id: string
  client_id: string
  client_name?: string | null
  name: string
  description: string | null
  status: string
  start_date: string | null
  end_date: string | null
  erp_project_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export function mapProjectRow(row: ProjectRow, contracts: AmcContract[] = [], taskCount = 0): Project {
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.client_name ?? undefined,
    name: row.name,
    description: row.description ?? undefined,
    status: row.status as Project['status'],
    startDate: row.start_date ?? undefined,
    endDate: row.end_date ?? undefined,
    erpProjectId: row.erp_project_id ?? undefined,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    contracts,
    taskCount,
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
  currency: string
  created_at: string
}

export function mapAmcPlanRow(row: AmcPlanRow): AmcPlan {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    defaultDurationMonths: row.default_duration_months,
    price: row.price === null ? undefined : Number(row.price),
    currency: row.currency,
    createdAt: row.created_at,
  }
}

export interface ContractRow {
  id: string
  client_id: string
  project_id: string | null
  plan_id: string
  plan_name?: string | null
  plan_price?: number | string | null
  start_date: string
  end_date: string
  status: string
  reminder_30d_sent: number
  reminder_7d_sent: number
  next_step: string | null
  next_step_at: string | null
  next_step_reminder_sent: number
  created_at: string
}

export function mapContractRow(row: ContractRow, lineItems: LineItem[] = []): AmcContract {
  const lineItemsTotal = lineItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const totalValue = lineItems.length
    ? lineItemsTotal
    : (row.plan_price !== null && row.plan_price !== undefined ? Number(row.plan_price) : undefined)

  return {
    id: row.id,
    clientId: row.client_id,
    projectId: row.project_id ?? undefined,
    planId: row.plan_id,
    planName: row.plan_name ?? undefined,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status as AmcContract['status'],
    reminder30dSent: !!row.reminder_30d_sent,
    reminder7dSent: !!row.reminder_7d_sent,
    nextStep: row.next_step ?? undefined,
    nextStepAt: row.next_step_at ?? undefined,
    nextStepReminderSent: !!row.next_step_reminder_sent,
    lineItems,
    totalValue,
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
  estimated_value: number | string | null
  notes: string | null
  converted_client_id: string | null
  next_step: string | null
  next_step_at: string | null
  next_step_reminder_sent: number
  created_at: string
  updated_at: string
}

export function mapLeadRow(
  row: LeadRow,
  activity: LeadActivity[] = [],
  assignees: Assignee[] = [],
  additionalEmails: LeadContactEmail[] = [],
  additionalPhones: LeadContactPhone[] = [],
  documents: LeadDocument[] = [],
  interactions: Interaction[] = [],
): Lead {
  return {
    id: row.id,
    name: row.name,
    contactName: row.contact_name ?? undefined,
    contactEmail: row.contact_email ?? undefined,
    contactPhone: row.contact_phone ?? undefined,
    additionalEmails,
    additionalPhones,
    documents,
    source: row.source ?? undefined,
    stage: row.stage as Lead['stage'],
    estimatedValue: row.estimated_value !== null ? Number(row.estimated_value) : undefined,
    notes: row.notes ?? undefined,
    assignees,
    convertedClientId: row.converted_client_id ?? undefined,
    nextStep: row.next_step ?? undefined,
    nextStepAt: row.next_step_at ?? undefined,
    nextStepReminderSent: !!row.next_step_reminder_sent,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    activity,
    interactions,
  }
}

export interface LeadContactEmailRow {
  id: string
  lead_id: string
  email: string
  label: string | null
  created_at: string
}

export function mapLeadContactEmailRow(row: LeadContactEmailRow): LeadContactEmail {
  return { id: row.id, email: row.email, label: row.label ?? undefined }
}

export interface LeadContactPhoneRow {
  id: string
  lead_id: string
  phone: string
  label: string | null
  created_at: string
}

export function mapLeadContactPhoneRow(row: LeadContactPhoneRow): LeadContactPhone {
  return { id: row.id, phone: row.phone, label: row.label ?? undefined }
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

export interface TenderRow {
  id: string
  title: string
  issuing_authority: string | null
  reference_number: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  source: string | null
  stage: string
  estimated_value: number | string | null
  submission_deadline: string | null
  deadline_reminder_sent: number
  notes: string | null
  converted_client_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export function mapTenderRow(
  row: TenderRow,
  activity: TenderActivity[] = [],
  assignees: Assignee[] = [],
  documents: TenderDocument[] = [],
  interactions: Interaction[] = [],
): Tender {
  return {
    id: row.id,
    title: row.title,
    issuingAuthority: row.issuing_authority ?? undefined,
    referenceNumber: row.reference_number ?? undefined,
    contactName: row.contact_name ?? undefined,
    contactEmail: row.contact_email ?? undefined,
    contactPhone: row.contact_phone ?? undefined,
    source: row.source ?? undefined,
    stage: row.stage as Tender['stage'],
    estimatedValue: row.estimated_value !== null ? Number(row.estimated_value) : undefined,
    submissionDeadline: row.submission_deadline ?? undefined,
    deadlineReminderSent: !!row.deadline_reminder_sent,
    notes: row.notes ?? undefined,
    assignees,
    convertedClientId: row.converted_client_id ?? undefined,
    documents,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    activity,
    interactions,
  }
}

export interface TenderDocumentRow {
  id: string
  tender_id: string
  name: string
  url: string
  type: string | null
  size: number | string | null
  uploaded_by: string | null
  created_at: string
}

export function mapTenderDocumentRow(row: TenderDocumentRow): TenderDocument {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    type: row.type ?? undefined,
    size: row.size !== null ? Number(row.size) : undefined,
    uploadedBy: row.uploaded_by ?? undefined,
    createdAt: row.created_at,
  }
}

export interface LeadDocumentRow {
  id: string
  lead_id: string
  name: string
  url: string
  type: string | null
  size: number | string | null
  uploaded_by: string | null
  created_at: string
}

export function mapLeadDocumentRow(row: LeadDocumentRow): LeadDocument {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    type: row.type ?? undefined,
    size: row.size !== null ? Number(row.size) : undefined,
    uploadedBy: row.uploaded_by ?? undefined,
    createdAt: row.created_at,
  }
}

export interface ClientDocumentRow {
  id: string
  client_id: string
  name: string
  url: string
  type: string | null
  size: number | string | null
  uploaded_by: string | null
  created_at: string
}

export function mapClientDocumentRow(row: ClientDocumentRow): ClientDocument {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    type: row.type ?? undefined,
    size: row.size !== null ? Number(row.size) : undefined,
    uploadedBy: row.uploaded_by ?? undefined,
    createdAt: row.created_at,
  }
}

export interface InteractionRow {
  id: string
  regarding_type: string
  regarding_id: string
  type: string
  subject: string | null
  body: string | null
  direction: string | null
  gmail_message_id: string | null
  gmail_thread_id: string | null
  calendar_event_id: string | null
  occurred_at: string
  logged_by: string | null
  logged_by_name?: string | null
  created_at: string
}

export function mapInteractionRow(row: InteractionRow): Interaction {
  return {
    id: row.id,
    type: row.type as Interaction['type'],
    subject: row.subject ?? undefined,
    body: row.body ?? undefined,
    direction: (row.direction as Interaction['direction']) ?? undefined,
    gmailMessageId: row.gmail_message_id ?? undefined,
    gmailThreadId: row.gmail_thread_id ?? undefined,
    occurredAt: row.occurred_at,
    loggedBy: row.logged_by ?? undefined,
    loggedByName: row.logged_by_name ?? undefined,
    createdAt: row.created_at,
  }
}

export interface TenderActivityRow {
  id: string
  tender_id: string
  type: string
  actor_id: string | null
  actor_name: string | null
  from_value: string | null
  to_value: string | null
  message: string | null
  created_at: string
}

export function mapTenderActivityRow(row: TenderActivityRow): TenderActivity {
  return {
    id: row.id,
    tenderId: row.tender_id,
    type: row.type as TenderActivity['type'],
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
  sprint_id: string | null
  sprint_name?: string | null
  sprint_status?: string | null
  project_id: string | null
  project_name?: string | null
  tender_id: string | null
  tender_name?: string | null
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
    sprintId: row.sprint_id ?? undefined,
    sprintName: row.sprint_name ?? undefined,
    sprintStatus: (row.sprint_status as Task['sprintStatus']) ?? undefined,
    projectId: row.project_id ?? undefined,
    projectName: row.project_name ?? undefined,
    tenderId: row.tender_id ?? undefined,
    tenderName: row.tender_name ?? undefined,
    startDate: row.start_date ?? undefined,
    dueDate: row.due_date ?? undefined,
    remindAt: row.remind_at ?? undefined,
    reminderSent: !!row.reminder_sent,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface SprintRow {
  id: string
  name: string
  goal: string | null
  status: string
  start_date: string | null
  end_date: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export function mapSprintRow(row: SprintRow): Sprint {
  return {
    id: row.id,
    name: row.name,
    goal: row.goal ?? undefined,
    status: row.status as Sprint['status'],
    startDate: row.start_date ?? undefined,
    endDate: row.end_date ?? undefined,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
