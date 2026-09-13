import type { VendorBill, VendorPaymentMethod } from '~/types/vendor-bill'

export interface NewVendorBillLineItem {
  description: string
  quantity: number
  unitPrice: number
}

export interface NewVendorBill {
  expenseAccountCode: string
  currency?: string
  taxRate?: number
  billDate?: string
  dueAt?: string
  reference?: string
  notes?: string
  lineItems: NewVendorBillLineItem[]
}

export interface NewVendorPayment {
  amount: number
  method: VendorPaymentMethod
  reference?: string
  paidAt?: string
}

export function useVendorBills() {
  const bills = useState<VendorBill[]>('vendor-bills-list', () => [])
  const outstandingByCurrency = useState<{ currency: string, balance: number }[]>('vendor-bills-outstanding-by-currency', () => [])

  function replaceBill(bill: VendorBill) {
    const index = bills.value.findIndex(b => b.id === bill.id)
    if (index === -1)
      bills.value.unshift(bill)
    else
      bills.value[index] = bill
  }

  // Mirrors server/utils/vendorBills.ts's computeOutstandingByCurrency, so the header summary on
  // /vendor-bills stays correct immediately after a mutation instead of only refreshing on reload.
  function recomputeOutstandingByCurrency() {
    const totals = new Map<string, number>()
    for (const bill of bills.value) {
      if (bill.balance <= 0)
        continue
      totals.set(bill.currency, (totals.get(bill.currency) ?? 0) + bill.balance)
    }
    outstandingByCurrency.value = [...totals.entries()].map(([currency, balance]) => ({ currency, balance }))
  }

  async function fetchBills() {
    const { bills: rows, outstandingByCurrency: totals } = await $fetch<{ bills: VendorBill[], outstandingByCurrency: { currency: string, balance: number }[] }>('/api/vendor-bills')
    bills.value = rows
    outstandingByCurrency.value = totals
  }

  async function fetchBill(id: string) {
    const { bill } = await $fetch<{ bill: VendorBill }>(`/api/vendor-bills/${id}`)
    replaceBill(bill)
    return bill
  }

  // Scoped to one vendor's own sheet, but merges into the same shared `bills` state (rather than
  // a disconnected local list) so a payment/delete inside VendorBillCard — which only updates
  // `bills` via replaceBill/removeBill — is immediately reflected back in the vendor's own view.
  async function fetchBillsForVendor(vendorId: string) {
    const { bills: rows } = await $fetch<{ bills: VendorBill[] }>(`/api/vendors/${vendorId}/bills`)
    for (const bill of rows)
      replaceBill(bill)
    return rows
  }

  async function addBill(vendorId: string, payload: NewVendorBill) {
    const { bill } = await $fetch<{ bill: VendorBill }>(`/api/vendors/${vendorId}/bills`, { method: 'POST', body: payload })
    replaceBill(bill)
    recomputeOutstandingByCurrency()
    return bill
  }

  async function removeBill(billId: string) {
    await $fetch(`/api/vendor-bills/${billId}`, { method: 'DELETE' })
    bills.value = bills.value.filter(b => b.id !== billId)
    recomputeOutstandingByCurrency()
  }

  async function addPayment(billId: string, payload: NewVendorPayment) {
    const { bill } = await $fetch<{ bill: VendorBill }>(`/api/vendor-bills/${billId}/payments`, { method: 'POST', body: payload })
    replaceBill(bill)
    recomputeOutstandingByCurrency()
    return bill
  }

  async function removePayment(billId: string, paymentId: string) {
    const { bill } = await $fetch<{ bill: VendorBill }>(`/api/vendor-bills/${billId}/payments/${paymentId}`, { method: 'DELETE' })
    replaceBill(bill)
    recomputeOutstandingByCurrency()
    return bill
  }

  return { bills, outstandingByCurrency, fetchBills, fetchBill, fetchBillsForVendor, addBill, removeBill, addPayment, removePayment }
}
