import type { Assignee } from './assignee'

export type TenderStage = 'identified' | 'registered' | 'preparing' | 'submitted' | 'evaluation' | 'won' | 'lost'

export type TenderActivityType = 'stage_changed' | 'note_updated' | 'assignee_changed' | 'converted' | 'deadline_updated' | 'document_added' | 'document_removed'

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
}
