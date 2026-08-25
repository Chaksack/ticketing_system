import type { AmcContract } from './amc'

export type ClientStage = 'lead' | 'contacted' | 'proposal' | 'negotiation' | 'active' | 'lost'

export type ClientActivityType = 'stage_changed' | 'note_updated' | 'assignee_changed' | 'amc_assigned' | 'amc_cancelled' | 'amc_renewal_reminder'

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

export interface Client {
  id: string
  name: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  stage: ClientStage
  notes?: string
  assignedTo?: string
  assignedToName?: string
  createdAt: string
  updatedAt: string
  activity: ClientActivity[]
  contracts: AmcContract[]
  /** Only populated by the list endpoint, as a lighter-weight alternative to `contracts`. */
  activeContractCount?: number
}
