import type { RegardingType } from '~/types/interaction'
import type { Quote, QuoteStatus } from '~/types/quote'

export interface NewQuoteLineItem {
  productId?: string
  productName: string
  unitPrice: number
  currency: string
  quantity: number
}

export interface NewQuote {
  regardingType: RegardingType
  regardingId: string
  notes?: string
  lineItems: NewQuoteLineItem[]
}

export function useQuotes() {
  const quotes = useState<Quote[]>('quotes-list', () => [])

  async function fetchQuotes(regardingType: RegardingType, regardingId: string) {
    const { quotes: rows } = await $fetch<{ quotes: Quote[] }>('/api/quotes', { query: { regardingType, regardingId } })
    quotes.value = rows
    return rows
  }

  async function addQuote(payload: NewQuote) {
    const { quote } = await $fetch<{ quote: Quote }>('/api/quotes', { method: 'POST', body: payload })
    quotes.value.unshift(quote)
    return quote
  }

  async function updateQuoteStatus(id: string, status: QuoteStatus) {
    const { quote } = await $fetch<{ quote: Quote }>(`/api/quotes/${id}`, { method: 'PATCH', body: { status } })
    const index = quotes.value.findIndex(q => q.id === id)
    if (index !== -1)
      quotes.value[index] = quote
    return quote
  }

  async function removeQuote(id: string) {
    await $fetch(`/api/quotes/${id}`, { method: 'DELETE' })
    quotes.value = quotes.value.filter(q => q.id !== id)
  }

  return { quotes, fetchQuotes, addQuote, updateQuoteStatus, removeQuote }
}
