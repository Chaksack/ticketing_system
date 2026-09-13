import type { RegardingType } from '~/types/interaction'
import type { Quote } from '~/types/quote'
import type { SalesOrder } from '~/types/sales-order'

export interface GenerateInvoicePayload {
  projectId?: string
  taxRate?: number
  discount?: number
  dueAt?: string
  notes?: string
}

export function useSalesOrders() {
  const orders = useState<SalesOrder[]>('sales-orders-list', () => [])

  async function fetchOrders(regardingType: RegardingType, regardingId: string) {
    const { orders: rows } = await $fetch<{ orders: SalesOrder[] }>('/api/sales-orders', { query: { regardingType, regardingId } })
    orders.value = rows
    return rows
  }

  async function confirmOrder(quoteId: string) {
    const { quote, order } = await $fetch<{ quote: Quote, order: SalesOrder }>(`/api/quotes/${quoteId}/confirm`, { method: 'POST' })
    orders.value.unshift(order)
    return { quote, order }
  }

  async function generateInvoice(orderId: string, payload: GenerateInvoicePayload = {}) {
    const result = await $fetch<{ pending: true, approval: unknown } | { invoice: unknown, order: SalesOrder }>(`/api/sales-orders/${orderId}/generate-invoice`, { method: 'POST', body: payload })
    if ('order' in result) {
      const index = orders.value.findIndex(o => o.id === orderId)
      if (index !== -1)
        orders.value[index] = result.order
    }
    return result
  }

  return { orders, fetchOrders, confirmOrder, generateInvoice }
}
