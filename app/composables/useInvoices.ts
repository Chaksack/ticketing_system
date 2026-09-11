import type { Client } from '~/types/client'
import type { ReceiptMethod } from '~/types/invoice'

export interface NewInvoiceLineItem {
  description: string
  quantity: number
  unitPrice: number
}

export interface NewInvoice {
  projectId?: string
  currency?: string
  taxRate?: number
  discount?: number
  dueAt?: string
  notes?: string
  lineItems: NewInvoiceLineItem[]
}

export interface NewReceipt {
  amount: number
  method: ReceiptMethod
  reference?: string
  receivedAt?: string
}

export function useInvoices() {
  const { replaceClient } = useClients()

  async function addInvoice(clientId: string, payload: NewInvoice) {
    const { client } = await $fetch<{ client: Client }>(`/api/clients/${clientId}/invoices`, { method: 'POST', body: payload })
    replaceClient(client)
    return client
  }

  async function removeInvoice(clientId: string, invoiceId: string) {
    const { client } = await $fetch<{ client: Client }>(`/api/clients/${clientId}/invoices/${invoiceId}`, { method: 'DELETE' })
    replaceClient(client)
    return client
  }

  async function addReceipt(invoiceId: string, payload: NewReceipt) {
    const { client } = await $fetch<{ client: Client }>(`/api/invoices/${invoiceId}/receipts`, { method: 'POST', body: payload })
    replaceClient(client)
    return client
  }

  async function removeReceipt(invoiceId: string, receiptId: string) {
    const { client } = await $fetch<{ client: Client }>(`/api/invoices/${invoiceId}/receipts/${receiptId}`, { method: 'DELETE' })
    replaceClient(client)
    return client
  }

  return { addInvoice, removeInvoice, addReceipt, removeReceipt }
}
