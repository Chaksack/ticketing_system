import type { Client, ClientStage } from '~/types/client'

export interface NewClient {
  name: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  stage?: ClientStage
  notes?: string
  assigneeIds?: string[]
}

export interface ClientPatch {
  name?: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  stage?: ClientStage
  notes?: string
  assigneeIds?: string[]
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

  async function removeClient(id: string) {
    await $fetch<{ success: true }>(`/api/clients/${id}`, { method: 'DELETE' })
    clients.value = clients.value.filter(c => c.id !== id)
  }

  async function addContactEmail(id: string, payload: { email: string, label?: string }) {
    const { client } = await $fetch<{ client: Client }>(`/api/clients/${id}/contact-emails`, { method: 'POST', body: payload })
    replaceClient(client)
    return client
  }

  async function removeContactEmail(id: string, emailId: string) {
    const { client } = await $fetch<{ client: Client }>(`/api/clients/${id}/contact-emails/${emailId}`, { method: 'DELETE' })
    replaceClient(client)
    return client
  }

  async function addContactPhone(id: string, payload: { phone: string, label?: string }) {
    const { client } = await $fetch<{ client: Client }>(`/api/clients/${id}/contact-phones`, { method: 'POST', body: payload })
    replaceClient(client)
    return client
  }

  async function removeContactPhone(id: string, phoneId: string) {
    const { client } = await $fetch<{ client: Client }>(`/api/clients/${id}/contact-phones/${phoneId}`, { method: 'DELETE' })
    replaceClient(client)
    return client
  }

  return {
    clients,
    upcomingRenewals,
    fetchClients,
    fetchUpcomingRenewals,
    fetchClient,
    addClient,
    updateClient,
    removeClient,
    addContactEmail,
    removeContactEmail,
    addContactPhone,
    removeContactPhone,
  }
}
