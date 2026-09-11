import type { Client } from '~/types/client'
import type { Invoice, ReceiptMethod } from '~/types/invoice'

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

  const invoices = useState<Invoice[]>('invoices-list', () => [])
  const balanceByCurrency = useState<{ currency: string, balance: number }[]>('invoices-balance-by-currency', () => [])

  function replaceInvoice(invoice: Invoice) {
    const index = invoices.value.findIndex(i => i.id === invoice.id)
    if (index === -1)
      invoices.value.unshift(invoice)
    else
      invoices.value[index] = invoice
  }

  async function fetchInvoices() {
    const { invoices: rows, balanceByCurrency: balances } = await $fetch<{ invoices: Invoice[], balanceByCurrency: { currency: string, balance: number }[] }>('/api/invoices')
    invoices.value = rows
    balanceByCurrency.value = balances
  }

  async function fetchInvoice(id: string) {
    const { invoice } = await $fetch<{ invoice: Invoice }>(`/api/invoices/${id}`)
    replaceInvoice(invoice)
    return invoice
  }

  async function addInvoice(clientId: string, payload: NewInvoice) {
    const { client, invoice } = await $fetch<{ client: Client, invoice: Invoice }>(`/api/clients/${clientId}/invoices`, { method: 'POST', body: payload })
    replaceClient(client)
    replaceInvoice(invoice)
    return client
  }

  async function removeInvoice(clientId: string, invoiceId: string) {
    const { client } = await $fetch<{ client: Client, invoiceId: string }>(`/api/clients/${clientId}/invoices/${invoiceId}`, { method: 'DELETE' })
    replaceClient(client)
    invoices.value = invoices.value.filter(i => i.id !== invoiceId)
    return client
  }

  async function addReceipt(invoiceId: string, payload: NewReceipt) {
    const { client, invoice } = await $fetch<{ client: Client, invoice: Invoice }>(`/api/invoices/${invoiceId}/receipts`, { method: 'POST', body: payload })
    replaceClient(client)
    replaceInvoice(invoice)
    return client
  }

  async function removeReceipt(invoiceId: string, receiptId: string) {
    const { client, invoice } = await $fetch<{ client: Client, invoice: Invoice }>(`/api/invoices/${invoiceId}/receipts/${receiptId}`, { method: 'DELETE' })
    replaceClient(client)
    replaceInvoice(invoice)
    return client
  }

  return { invoices, balanceByCurrency, fetchInvoices, fetchInvoice, addInvoice, removeInvoice, addReceipt, removeReceipt }
}
