export type LeadStage = 'new' | 'contacted' | 'qualified' | 'proposal' | 'won' | 'lost'

export type LeadActivityType = 'stage_changed' | 'note_updated' | 'assignee_changed' | 'converted'

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

export interface Lead {
  id: string
  name: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  source?: string
  stage: LeadStage
  notes?: string
  assignedTo?: string
  assignedToName?: string
  convertedClientId?: string
  createdAt: string
  updatedAt: string
  activity: LeadActivity[]
}
