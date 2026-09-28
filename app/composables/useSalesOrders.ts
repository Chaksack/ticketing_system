import type { RegardingType } from '~/types/interaction'
import type { Quote } from '~/types/quote'
import type { SalesOrder } from '~/types/sales-order'

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

  return { orders, fetchOrders, confirmOrder }
}
