/**
 * Canopy Care — Canopy's managed customer-service team answering for a client company, inside
 * that company's own workspace. Engagements, quality evaluations and shifts live in the control
 * plane (they span companies); conversations stay in the client's database.
 */
export type CareStage = 'scope' | 'agreement' | 'transition' | 'pilot' | 'live' | 'ended'
export type CareModel = 'dedicated' | 'shared' | 'outcome'

export const CARE_STAGES: { value: CareStage, label: string }[] = [
  { value: 'scope', label: '1 · Scope' },
  { value: 'agreement', label: '2 · CSA & SLA' },
  { value: 'transition', label: '3 · Transition' },
  { value: 'pilot', label: '4 · Pilot' },
  { value: 'live', label: '5 · Live' },
]

export const CARE_MODELS: { value: CareModel, label: string, basis: string, note: string }[] = [
  { value: 'shared', label: 'Shared pool', basis: 'Per handled conversation', note: 'Effort drawn from the shared pool across clients' },
  { value: 'dedicated', label: 'Dedicated team', basis: 'Per agent per month', note: 'Agents dedicated to this client and trained on their brand' },
  { value: 'outcome', label: 'Outcome-based', basis: 'Per resolved case', note: 'Staffed by Canopy to hit the resolution target' },
]

export const CARE_CHANNELS = ['Web chat', 'Email', 'Voice', 'WhatsApp', 'Outbound reminders'] as const

export const DEFAULT_CARE_CHECKLIST = [
  'Care agents added to the client workspace (client admin approved)',
  'Knowledge base reviewed with the client',
  'Phone number ported or forwarded (voice only)',
  'Agents certified (quiz + 20 shadowed contacts)',
  'Quality scorecard agreed with the client',
]

export const DEFAULT_SCORECARD = [
  { label: 'Greeting & verification', weight: 15 },
  { label: 'Understood the need', weight: 20 },
  { label: 'Correct resolution', weight: 30 },
  { label: 'Followed the playbook', weight: 20 },
  { label: 'Tone & empathy', weight: 15 },
]

/** Planning assumptions for the staffing estimate — replace with pilot data. */
export const CARE_PRODUCTIVE_HOURS_PER_AGENT = 150
export const CARE_SHRINKAGE = 0.3

export interface CareEngagement {
  id: string
  orgId: string
  orgName?: string
  orgSlug?: string
  stage: CareStage
  model: CareModel
  channels: string[]
  reasons: { label: string, inScope: boolean }[]
  hours: string
  languages: string
  monthlyContacts: number
  ahtMinutes: number
  greeting: string
  slaText: string
  /** First reply target for live chat, in seconds — used for the service-level figures. */
  replyTargetSeconds: number
  dos: string
  donts: string
  checklist: { label: string, done: boolean }[]
  scorecard: { label: string, weight: number }[]
  agentIds: string[]
  recommendations: { id: string, text: string, approvedAt?: string, approvedBy?: string }[]
  createdAt: string
  updatedAt: string
}

/** One conversation in the agent desktop (a live chat or a ticket in some client's workspace). */
export interface CareConversation {
  orgId: string
  orgName: string
  engagementId: string
  kind: 'chat' | 'ticket'
  id: string
  customer: string
  preview: string
  status: string
  waitingSince: string
  assigneeName?: string
}

export interface CareEvaluation {
  id: string
  engagementId: string
  orgId: string
  orgName?: string
  refType: 'chat' | 'ticket'
  refId: string
  refTitle: string
  agentId?: string
  agentName?: string
  evaluatorName: string
  scores: { label: string, weight: number, result: 'met' | 'partly' | 'missed' }[]
  score: number
  note?: string
  shared: boolean
  createdAt: string
}

export interface CareShift {
  id: string
  staffId: string
  staffName: string
  date: string
  startHour: number
  endHour: number
}
