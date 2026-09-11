import type { Assignee } from './assignee'
import type { Interaction } from './interaction'

export type TenderStage = 'identified' | 'registered' | 'preparing' | 'submitted' | 'evaluation' | 'won' | 'lost'

export const TENDER_STAGE_PROBABILITY: Record<TenderStage, number> = {
  identified: 10,
  registered: 25,
  preparing: 40,
  submitted: 60,
  evaluation: 75,
  won: 100,
  lost: 0,
}

export type TenderActivityType = 'stage_changed' | 'note_updated' | 'assignee_changed' | 'converted' | 'deadline_updated' | 'document_added' | 'document_removed' | 'automation_applied'

export interface TenderActivity {
  id: string
  tenderId: string
  type: TenderActivityType
  actorId?: string
  actorName?: string
  fromValue?: string
  toValue?: string
  message?: string
  createdAt: string
}

export interface TenderDocument {
  id: string
  name: string
  url: string
  type?: string
  size?: number
  uploadedBy?: string
  createdAt: string
}

export interface Tender {
  id: string
  title: string
  issuingAuthority?: string
  referenceNumber?: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  source?: string
  stage: TenderStage
  estimatedValue?: number
  submissionDeadline?: string
  deadlineReminderSent: boolean
  notes?: string
  assignees: Assignee[]
  convertedClientId?: string
  documents: TenderDocument[]
  createdBy?: string
  createdAt: string
  updatedAt: string
  activity: TenderActivity[]
  interactions: Interaction[]
}
