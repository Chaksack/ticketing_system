import type { PaymentRun, VendorPaymentMethod } from '~/types/vendor-bill'

export interface NewPaymentRun {
  billIds: string[]
  method: VendorPaymentMethod
  paymentDate?: string
  reference?: string
}

export function usePaymentRuns() {
  const runs = useState<PaymentRun[]>('payment-runs-list', () => [])

  async function fetchRuns() {
    const { runs: rows } = await $fetch<{ runs: PaymentRun[] }>('/api/payment-runs')
    runs.value = rows
  }

  async function createRun(payload: NewPaymentRun) {
    const { run } = await $fetch<{ run: PaymentRun }>('/api/payment-runs', { method: 'POST', body: payload })
    runs.value.unshift(run)
    return run
  }

  return { runs, fetchRuns, createRun }
}
