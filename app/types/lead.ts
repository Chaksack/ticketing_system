import type { Assignee } from './assignee'
import type { Interaction } from './interaction'

export type LeadStage = 'new' | 'contacted' | 'qualified' | 'proposal' | 'won' | 'lost'

export const LEAD_STAGE_PROBABILITY: Record<LeadStage, number> = {
  new: 10,
  contacted: 25,
  qualified: 40,
  proposal: 60,
  won: 100,
  lost: 0,
}

export type LeadActivityType = 'stage_changed' | 'note_updated' | 'assignee_changed' | 'converted' | 'next_step_updated' | 'document_added' | 'document_removed'

export interface LeadActivity {
  id: string
  leadId: string
  type: LeadActivityType
  actorId?: string
  actorName?: string
  fromValue?: string
  toValue?: string
  message?: string
  createdAt: string
}

export interface LeadContactEmail {
  id: string
  email: string
  label?: string
}

export interface LeadContactPhone {
  id: string
  phone: string
  label?: string
}

export interface LeadDocument {
  id: string
  name: string
  url: string
  type?: string
  size?: number
  uploadedBy?: string
  createdAt: string
}

export interface Lead {
  id: string
  name: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  additionalEmails: LeadContactEmail[]
  additionalPhones: LeadContactPhone[]
  documents: LeadDocument[]
  source?: string
  stage: LeadStage
  estimatedValue?: number
  notes?: string
  assignees: Assignee[]
  convertedClientId?: string
  nextStep?: string
  nextStepAt?: string
  nextStepReminderSent: boolean
  createdAt: string
  updatedAt: string
  activity: LeadActivity[]
  interactions: Interaction[]
}
