import type { Assignee } from './assignee'

export type LeadStage = 'new' | 'contacted' | 'qualified' | 'proposal' | 'won' | 'lost'

export type LeadActivityType = 'stage_changed' | 'note_updated' | 'assignee_changed' | 'converted' | 'next_step_updated'

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

export interface Lead {
  id: string
  name: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  additionalEmails: LeadContactEmail[]
  additionalPhones: LeadContactPhone[]
  source?: string
  stage: LeadStage
  notes?: string
  assignees: Assignee[]
  convertedClientId?: string
  nextStep?: string
  nextStepAt?: string
  nextStepReminderSent: boolean
  createdAt: string
  updatedAt: string
  activity: LeadActivity[]
}
