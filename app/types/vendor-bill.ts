export type VendorBillStatus = 'unpaid' | 'partial' | 'paid'
export type VendorPaymentMethod = 'cash' | 'bank_transfer' | 'cheque' | 'mobile_money' | 'card' | 'other'

export interface VendorBillLineItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  lineTotal: number
  createdAt: string
}

export interface VendorPayment {
  id: string
  billId: string
  paymentRunId?: string
  amount: number
  method: VendorPaymentMethod
  paidAt: string
  reference?: string
  recordedBy?: string
  recordedByName?: string
  createdAt: string
}

export interface VendorBill {
  id: string
  vendorId: string
  vendorName?: string
  expenseAccountCode: string
  expenseAccountName?: string
  status: VendorBillStatus
  billDate: string
  dueAt?: string
  reference?: string
  notes?: string
  currency: string
  subtotal: number
  taxRate: number
  taxAmount: number
  total: number
  amountPaid: number
  balance: number
  lineItems: VendorBillLineItem[]
  payments: VendorPayment[]
  createdBy?: string
  createdByName?: string
  createdAt: string
  updatedAt: string
}

export interface PaymentRun {
  id: string
  paymentDate: string
  method: VendorPaymentMethod
  reference?: string
  total: number
  billCount: number
  createdBy?: string
  createdByName?: string
  createdAt: string
}
