import type { RegardingType } from '~/types/interaction'
import type { Quote } from '~/types/quote'

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
    const { quotes: rows } = await fetchUntyped<{ quotes: Quote[] }>('/api/quotes', { query: { regardingType, regardingId } })
    quotes.value = rows
    return rows
  }

  async function addQuote(payload: NewQuote) {
    const { quote } = await fetchUntyped<{ quote: Quote }>('/api/quotes', { method: 'POST', body: payload })
    quotes.value.unshift(quote)
    return quote
  }

  async function removeQuote(id: string) {
    await fetchUntyped<{ ok: boolean }>(`/api/quotes/${id}`, { method: 'DELETE' })
    quotes.value = quotes.value.filter(q => q.id !== id)
  }

  return { quotes, fetchQuotes, addQuote, removeQuote }
}
