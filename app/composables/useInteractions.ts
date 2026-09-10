import type { Client } from '~/types/client'
import type { InteractionDirection, InteractionType, RegardingType } from '~/types/interaction'
import type { Lead } from '~/types/lead'
import type { Tender } from '~/types/tender'

export interface NewInteraction {
  regardingType: RegardingType
  regardingId: string
  type: InteractionType
  subject?: string
  body?: string
  direction?: InteractionDirection
  gmailMessageId?: string
  gmailThreadId?: string
  occurredAt?: string
}

type InteractionParentResponse
  = | { lead: Lead }
    | { tender: Tender }
    | { client: Client }

export function useInteractions() {
  const { replaceLead } = useLeads()
  const { replaceTender } = useTenders()
  const { replaceClient } = useClients()

  function applyParent(result: InteractionParentResponse) {
    if ('lead' in result) {
      replaceLead(result.lead)
      return result.lead
    }
    if ('tender' in result) {
      replaceTender(result.tender)
      return result.tender
    }
    replaceClient(result.client)
    return result.client
  }

  async function addInteraction(payload: NewInteraction) {
    const result = await $fetch<InteractionParentResponse>('/api/interactions', { method: 'POST', body: payload })
    return applyParent(result)
  }

  async function removeInteraction(id: string) {
    const result = await $fetch<InteractionParentResponse>(`/api/interactions/${id}`, { method: 'DELETE' })
    return applyParent(result)
  }

  return {
    addInteraction,
    removeInteraction,
  }
}
