import type { Client } from '~/types/client'
import type { Tender, TenderStage } from '~/types/tender'

export interface NewTender {
  title: string
  issuingAuthority?: string
  referenceNumber?: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  source?: string
  stage?: TenderStage
  estimatedValue?: number
  submissionDeadline?: string
  notes?: string
  assigneeIds?: string[]
}

export interface TenderPatch {
  title?: string
  issuingAuthority?: string | null
  referenceNumber?: string | null
  contactName?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  source?: string | null
  stage?: TenderStage
  estimatedValue?: number | null
  submissionDeadline?: string | null
  notes?: string | null
  assigneeIds?: string[]
}

export function useTenders() {
  const tenders = useState<Tender[]>('tenders-list', () => [])

  async function fetchTenders() {
    const { tenders: rows } = await $fetch('/api/tenders')
    tenders.value = rows
  }

  function replaceTender(tender: Tender) {
    const index = tenders.value.findIndex(t => t.id === tender.id)
    if (index === -1)
      tenders.value.unshift(tender)
    else
      tenders.value[index] = tender
  }

  async function fetchTender(id: string) {
    const { tender } = await $fetch<{ tender: Tender }>(`/api/tenders/${id}`)
    replaceTender(tender)
    return tender
  }

  async function addTender(payload: NewTender) {
    const { tender } = await $fetch('/api/tenders', { method: 'POST', body: payload })
    tenders.value.unshift(tender)
    return tender
  }

  async function updateTender(id: string, patch: TenderPatch) {
    const { tender } = await $fetch<{ tender: Tender }>(`/api/tenders/${id}`, { method: 'PATCH', body: patch })
    replaceTender(tender)
    return tender
  }

  async function convertTender(id: string) {
    const { client } = await $fetch<{ client: Client }>(`/api/tenders/${id}/convert`, { method: 'POST' })
    await fetchTender(id)
    return client
  }

  async function removeTender(id: string) {
    await $fetch<{ success: true }>(`/api/tenders/${id}`, { method: 'DELETE' })
    tenders.value = tenders.value.filter(t => t.id !== id)
  }

  async function uploadDocument(id: string, file: File) {
    const formData = new FormData()
    formData.append('document', file)

    const { tender } = await $fetch<{ tender: Tender }>(`/api/tenders/${id}/documents`, { method: 'POST', body: formData })
    replaceTender(tender)
    return tender
  }

  async function removeDocument(id: string, docId: string) {
    const { tender } = await $fetch<{ tender: Tender }>(`/api/tenders/${id}/documents/${docId}`, { method: 'DELETE' })
    replaceTender(tender)
    return tender
  }

  return {
    tenders,
    fetchTenders,
    fetchTender,
    replaceTender,
    addTender,
    updateTender,
    convertTender,
    removeTender,
    uploadDocument,
    removeDocument,
  }
}
