import type { AmcContract } from './amc'
import type { Assignee } from './assignee'
import type { Project } from './project'

export type ClientStage = 'lead' | 'contacted' | 'proposal' | 'negotiation' | 'active' | 'lost'

export type ClientActivityType = 'stage_changed' | 'note_updated' | 'assignee_changed' | 'amc_assigned' | 'amc_cancelled' | 'amc_renewal_reminder' | 'converted_from_lead'

export interface ClientActivity {
  id: string
  clientId: string
  type: ClientActivityType
  actorId?: string
  actorName?: string
  fromValue?: string
  toValue?: string
  message?: string
  createdAt: string
}

export interface ClientContactEmail {
  id: string
  email: string
  label?: string
}

export interface ClientContactPhone {
  id: string
  phone: string
  label?: string
}

export interface Client {
  id: string
  name: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  additionalEmails: ClientContactEmail[]
  additionalPhones: ClientContactPhone[]
  stage: ClientStage
  notes?: string
  assignees: Assignee[]
  createdAt: string
  updatedAt: string
  activity: ClientActivity[]
  projects: Project[]
  /** Contracts predating Projects, not linked to any project (client-level "legacy" contracts). */
  contracts: AmcContract[]
  /** Only populated by the list endpoint, as a lighter-weight alternative to `contracts`. */
  activeContractCount?: number
}
