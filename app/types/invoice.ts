export type InvoiceStatus = 'unpaid' | 'partial' | 'paid'
export type ReceiptMethod = 'cash' | 'bank_transfer' | 'cheque' | 'mobile_money' | 'card' | 'other'
export type InvoiceActivityType = 'created' | 'payment_received' | 'payment_removed'

export interface InvoiceLineItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  lineTotal: number
  createdAt: string
}

export interface InvoiceActivity {
  id: string
  invoiceId: string
  type: InvoiceActivityType
  actorId?: string
  actorName?: string
  fromValue?: string
  toValue?: string
  message?: string
  createdAt: string
}

export interface Receipt {
  id: string
  invoiceId: string
  amount: number
  method: ReceiptMethod
  receivedAt: string
  reference?: string
  recordedBy?: string
  recordedByName?: string
  createdAt: string
}

export interface Invoice {
  id: string
  clientId: string
  clientName?: string
  projectId?: string
  status: InvoiceStatus
  issuedAt?: string
  dueAt?: string
  notes?: string
  currency: string
  subtotal: number
  taxRate: number
  taxAmount: number
  discount: number
  total: number
  amountPaid: number
  balance: number
  lineItems: InvoiceLineItem[]
  receipts: Receipt[]
  activity: InvoiceActivity[]
  createdBy?: string
  createdByName?: string
  createdAt: string
  updatedAt: string
}
