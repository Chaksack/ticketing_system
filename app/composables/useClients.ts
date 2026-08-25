import type { Client, ClientStage } from '~/types/client'

export interface NewClient {
  name: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  stage?: ClientStage
  notes?: string
  assignedTo?: string
}

export interface ClientPatch {
  name?: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  stage?: ClientStage
  notes?: string
  assignedTo?: string | null
}

export interface UpcomingRenewal {
  contractId: string
  clientId: string
  clientName: string
  planName: string
  endDate: string
}

export function useClients() {
  const clients = useState<Client[]>('clients-list', () => [])
  const upcomingRenewals = useState<UpcomingRenewal[]>('clients-upcoming-renewals', () => [])

  async function fetchClients() {
    const { clients: rows } = await $fetch('/api/clients')
    clients.value = rows
  }

  async function fetchUpcomingRenewals() {
    const { renewals } = await $fetch<{ renewals: UpcomingRenewal[] }>('/api/clients/upcoming-renewals')
    upcomingRenewals.value = renewals
  }

  function replaceClient(client: Client) {
    const index = clients.value.findIndex(c => c.id === client.id)
    if (index === -1)
      clients.value.unshift(client)
    else
      clients.value[index] = client
  }

  // NOTE: these calls are explicitly typed with a generic rather than relying on Nitro's
  // typed-fetch inference — /api/clients/upcoming-renewals is a static sibling of the
  // /api/clients/[id] routes, so TS can't rule out `${id}` equaling "upcoming-renewals" and
  // would otherwise union both routes' response types together.
  async function fetchClient(id: string) {
    const { client } = await $fetch<{ client: Client }>(`/api/clients/${id}`)
    replaceClient(client)
    return client
  }

  async function addClient(payload: NewClient) {
    const { client } = await $fetch('/api/clients', { method: 'POST', body: payload })
    clients.value.unshift(client)
    return client
  }

  async function updateClient(id: string, patch: ClientPatch) {
    const { client } = await $fetch<{ client: Client }>(`/api/clients/${id}`, { method: 'PATCH', body: patch })
    replaceClient(client)
    return client
  }

  async function assignAmc(id: string, payload: { planId: string, startDate: string, endDate: string }) {
    const { client } = await $fetch<{ client: Client }>(`/api/clients/${id}/amc-contracts`, { method: 'POST', body: payload })
    replaceClient(client)
    return client
  }

  async function removeClient(id: string) {
    await $fetch<{ success: true }>(`/api/clients/${id}`, { method: 'DELETE' })
    clients.value = clients.value.filter(c => c.id !== id)
  }

  return { clients, upcomingRenewals, fetchClients, fetchUpcomingRenewals, fetchClient, addClient, updateClient, assignAmc, removeClient }
}
