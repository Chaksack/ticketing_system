import type { Client } from '~/types/client'
import type { Lead, LeadStage } from '~/types/lead'

export interface NewLead {
  name: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  source?: string
  stage?: LeadStage
  notes?: string
  assigneeIds?: string[]
  nextStep?: string
  nextStepAt?: string
}

export interface LeadPatch {
  name?: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  source?: string
  stage?: LeadStage
  notes?: string
  assigneeIds?: string[]
  nextStep?: string | null
  nextStepAt?: string | null
}

export function useLeads() {
  const leads = useState<Lead[]>('leads-list', () => [])

  async function fetchLeads() {
    const { leads: rows } = await $fetch('/api/leads')
    leads.value = rows
  }

  function replaceLead(lead: Lead) {
    const index = leads.value.findIndex(l => l.id === lead.id)
    if (index === -1)
      leads.value.unshift(lead)
    else
      leads.value[index] = lead
  }

  async function fetchLead(id: string) {
    const { lead } = await $fetch<{ lead: Lead }>(`/api/leads/${id}`)
    replaceLead(lead)
    return lead
  }

  async function addLead(payload: NewLead) {
    const { lead } = await $fetch('/api/leads', { method: 'POST', body: payload })
    leads.value.unshift(lead)
    return lead
  }

  async function updateLead(id: string, patch: LeadPatch) {
    const { lead } = await $fetch<{ lead: Lead }>(`/api/leads/${id}`, { method: 'PATCH', body: patch })
    replaceLead(lead)
    return lead
  }

  async function convertLead(id: string) {
    const { client } = await $fetch<{ client: Client }>(`/api/leads/${id}/convert`, { method: 'POST' })
    await fetchLead(id)
    return client
  }

  async function removeLead(id: string) {
    await $fetch<{ success: true }>(`/api/leads/${id}`, { method: 'DELETE' })
    leads.value = leads.value.filter(l => l.id !== id)
  }

  async function addContactEmail(id: string, payload: { email: string, label?: string }) {
    const { lead } = await $fetch<{ lead: Lead }>(`/api/leads/${id}/contact-emails`, { method: 'POST', body: payload })
    replaceLead(lead)
    return lead
  }

  async function removeContactEmail(id: string, emailId: string) {
    const { lead } = await $fetch<{ lead: Lead }>(`/api/leads/${id}/contact-emails/${emailId}`, { method: 'DELETE' })
    replaceLead(lead)
    return lead
  }

  async function addContactPhone(id: string, payload: { phone: string, label?: string }) {
    const { lead } = await $fetch<{ lead: Lead }>(`/api/leads/${id}/contact-phones`, { method: 'POST', body: payload })
    replaceLead(lead)
    return lead
  }

  async function removeContactPhone(id: string, phoneId: string) {
    const { lead } = await $fetch<{ lead: Lead }>(`/api/leads/${id}/contact-phones/${phoneId}`, { method: 'DELETE' })
    replaceLead(lead)
    return lead
  }

  return {
    leads,
    fetchLeads,
    fetchLead,
    addLead,
    updateLead,
    convertLead,
    removeLead,
    addContactEmail,
    removeContactEmail,
    addContactPhone,
    removeContactPhone,
  }
}
