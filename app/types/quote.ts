import type { RegardingType } from './interaction'
import type { LineItem } from './product'

export type QuoteStatus = 'quoted' | 'ordered' | 'invoiced'

export interface Quote {
  id: string
  regardingType: RegardingType
  regardingId: string
  status: QuoteStatus
  notes?: string
  lineItems: LineItem[]
  total: number
  createdBy?: string
  createdByName?: string
  createdAt: string
  updatedAt: string
}
