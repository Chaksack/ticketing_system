import type { RegardingType } from './interaction'
import type { LineItem } from './product'

export type SalesOrderStatus = 'confirmed' | 'invoiced' | 'cancelled'

export interface SalesOrder {
  id: string
  quoteId: string
  regardingType: RegardingType
  regardingId: string
  status: SalesOrderStatus
  currency: string
  total: number
  notes?: string
  lineItems: LineItem[]
  createdBy?: string
  createdByName?: string
  createdAt: string
  updatedAt: string
}
