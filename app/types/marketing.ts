/** Who a segment can contain: people with an email address on a lead, a client, or a named client contact. */
export type ContactKind = 'lead' | 'client' | 'client_contact'

export const CONTACT_KINDS: { value: ContactKind, label: string }[] = [
  { value: 'lead', label: 'Lead contact' },
  { value: 'client', label: 'Client main contact' },
  { value: 'client_contact', label: 'Client named contact' },
]

export type SegmentField
  = | 'kind'
    | 'lead_stage'
    | 'client_stage'
    | 'source'
    | 'created_within_days'
    | 'estimated_value_at_least'
    | 'assigned_to'
    | 'has_open_lead'
    | 'opened_email_within_days'

export interface SegmentFieldDef {
  value: SegmentField
  group: 'Record' | 'Pipeline' | 'Behaviour'
  label: string
  /** How the value is entered. */
  input: 'multi' | 'number' | 'boolean' | 'text'
  operatorLabel: string
}

export const SEGMENT_FIELDS: SegmentFieldDef[] = [
  { value: 'kind', group: 'Record', label: 'Record type', input: 'multi', operatorLabel: 'is any of' },
  { value: 'source', group: 'Record', label: 'Lead source', input: 'text', operatorLabel: 'contains' },
  { value: 'created_within_days', group: 'Record', label: 'Created', input: 'number', operatorLabel: 'within the last (days)' },
  { value: 'assigned_to', group: 'Record', label: 'Owner', input: 'multi', operatorLabel: 'is any of' },
  { value: 'lead_stage', group: 'Pipeline', label: 'Lead stage', input: 'multi', operatorLabel: 'is any of' },
  { value: 'client_stage', group: 'Pipeline', label: 'Client stage', input: 'multi', operatorLabel: 'is any of' },
  { value: 'estimated_value_at_least', group: 'Pipeline', label: 'Estimated value', input: 'number', operatorLabel: 'is at least' },
  { value: 'has_open_lead', group: 'Pipeline', label: 'Has an open lead', input: 'boolean', operatorLabel: 'is' },
  { value: 'opened_email_within_days', group: 'Behaviour', label: 'Opened a journey email', input: 'number', operatorLabel: 'within the last (days)' },
]

export interface SegmentCondition {
  id: string
  field: SegmentField
  /** Values for multi; a number for number fields; 'true'/'false' for boolean; text for text. */
  values: string[]
  /** An "AND NOT" block: contacts matching it are left out. */
  exclude: boolean
}

export interface Segment {
  id: string
  name: string
  description?: string
  conditions: SegmentCondition[]
  createdAt: string
  updatedAt: string
}

export interface SegmentMember {
  key: string
  kind: ContactKind
  name: string
  email: string
  company?: string
}

export interface SegmentPreview {
  total: number
  /** Members who unsubscribed and won't receive journey emails. */
  unsubscribed: number
  sample: SegmentMember[]
}

// ── Journeys ───────────────────────────────────────────────────────────────

export type JourneyStatus = 'draft' | 'active' | 'paused'
export type JourneyTrigger = 'segment' | 'demo_request'

export type BranchCondition = 'opened_last_email' | 'lead_stage_is' | 'became_client'

export type JourneyStep
  = | { id: string, type: 'email', subject: string, body: string }
    | { id: string, type: 'wait', days: number }
    | { id: string, type: 'branch', condition: BranchCondition, value?: string, yes: JourneyStep[], no: JourneyStep[] }
    | { id: string, type: 'create_lead', note?: string }
    | { id: string, type: 'notify_owner', message: string }

export const JOURNEY_STEP_LABELS: Record<JourneyStep['type'], string> = {
  email: 'Send email',
  wait: 'Wait',
  branch: 'If / then branch',
  create_lead: 'Create lead for Sales',
  notify_owner: 'Notify the owner',
}

export const BRANCH_LABELS: Record<BranchCondition, string> = {
  opened_last_email: 'Opened the previous email?',
  lead_stage_is: 'Their lead reached a stage?',
  became_client: 'Became a client?',
}

export interface Journey {
  id: string
  name: string
  status: JourneyStatus
  trigger: JourneyTrigger
  segmentId?: string
  segmentName?: string
  steps: JourneyStep[]
  /** "HH:MM" GMT — no emails go out between these times. */
  quietStart?: string
  quietEnd?: string
  exitAfterDays?: number
  publishedAt?: string
  createdAt: string
  updatedAt: string
  stats: { enrolled: number, active: number, completed: number, sent: number, opened: number }
}
