<script setup lang="ts">
import type { VendorPaymentMethod } from '~/types/vendor-bill'
import { toast } from 'vue-sonner'

definePageMeta({
  middleware: 'finance',
})

const { bills, fetchBills } = useVendorBills()
const { runs, fetchRuns, createRun } = usePaymentRuns()

onMounted(() => {
  fetchBills()
  fetchRuns()
})

const outstandingBills = computed(() => bills.value.filter(b => b.balance > 0))

const PAYMENT_METHODS: { value: VendorPaymentMethod, label: string }[] = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
]

const selectedBillIds = ref<string[]>([])
const paymentMethod = ref<VendorPaymentMethod>('bank_transfer')
const paymentDate = ref(new Date().toISOString().slice(0, 10))
const reference = ref('')
const isSaving = ref(false)

const selectedBills = computed(() => outstandingBills.value.filter(b => selectedBillIds.value.includes(b.id)))
const selectedTotal = computed(() => selectedBills.value.reduce((sum, b) => sum + b.balance, 0))

function toggleBill(billId: string, checked: boolean) {
  selectedBillIds.value = checked
    ? [...selectedBillIds.value, billId]
    : selectedBillIds.value.filter(id => id !== billId)
}

async function onPaySelected() {
  if (!selectedBillIds.value.length)
    return

  isSaving.value = true
  try {
    const run = await createRun({
      billIds: selectedBillIds.value,
      method: paymentMethod.value,
      paymentDate: paymentDate.value || undefined,
      reference: reference.value.trim() || undefined,
    })
    selectedBillIds.value = []
    reference.value = ''
    await fetchBills()
    toast('Payment run posted', { description: `${run.billCount} bill(s), ${run.total.toLocaleString()} total.` })
  }
  catch (error: any) {
    toast.error('Could not post payment run', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
  finally {
    isSaving.value = false
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}
</script>

<template>
  <div class="w-full flex flex-col items-stretch gap-6">
    <div>
      <h2 class="text-2xl font-bold tracking-tight">
        Payment Runs
      </h2>
      <p class="text-muted-foreground">
        Select outstanding bills and settle several at once in a single batch.
      </p>
    </div>

    <div class="flex flex-col gap-3 rounded-md border p-4">
      <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div class="flex flex-col gap-1.5">
          <Label class="text-xs text-muted-foreground">Payment Date</Label>
          <Input v-model="paymentDate" type="date" class="h-8 text-xs" />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label class="text-xs text-muted-foreground">Method</Label>
          <Select v-model="paymentMethod">
            <SelectTrigger class="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="option in PAYMENT_METHODS" :key="option.value" :value="option.value">
                {{ option.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="flex flex-col gap-1.5">
          <Label class="text-xs text-muted-foreground">Reference (optional)</Label>
          <Input v-model="reference" placeholder="Batch reference" class="h-8 text-xs" />
        </div>
      </div>

      <div class="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead class="w-10" />
              <TableHead>Bill</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead class="text-right">
                Balance
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <template v-if="outstandingBills.length">
              <TableRow v-for="bill in outstandingBills" :key="bill.id">
                <TableCell>
                  <Checkbox
                    :model-value="selectedBillIds.includes(bill.id)"
                    @update:model-value="(checked) => toggleBill(bill.id, !!checked)"
                  />
                </TableCell>
                <TableCell class="font-mono text-xs">
                  {{ bill.id }}
                </TableCell>
                <TableCell class="font-medium">
                  {{ bill.vendorName || '—' }}
                </TableCell>
                <TableCell class="text-right tabular-nums">
                  {{ bill.balance.toLocaleString() }} {{ bill.currency }}
                </TableCell>
              </TableRow>
            </template>
            <TableRow v-else>
              <TableCell :colspan="4" class="h-20 text-center text-muted-foreground">
                No outstanding vendor bills.
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div class="flex items-center justify-between border-t pt-3">
        <span class="text-xs text-muted-foreground">
          {{ selectedBillIds.length }} bill(s) selected · Total {{ selectedTotal.toLocaleString() }}
        </span>
        <Button size="sm" :disabled="!selectedBillIds.length || isSaving" @click="onPaySelected">
          Pay Selected
        </Button>
      </div>
    </div>

    <div class="flex flex-col gap-3">
      <h3 class="text-sm font-medium">
        Past Runs
      </h3>
      <div class="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Run</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Bills</TableHead>
              <TableHead class="text-right">
                Total
              </TableHead>
              <TableHead>Reference</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <template v-if="runs.length">
              <TableRow v-for="run in runs" :key="run.id">
                <TableCell class="font-mono text-xs">
                  {{ run.id }}
                </TableCell>
                <TableCell class="text-sm">
                  {{ formatDate(run.paymentDate) }}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" class="capitalize">
                    {{ run.method.replace('_', ' ') }}
                  </Badge>
                </TableCell>
                <TableCell class="tabular-nums">
                  {{ run.billCount }}
                </TableCell>
                <TableCell class="text-right tabular-nums">
                  {{ run.total.toLocaleString() }}
                </TableCell>
                <TableCell class="text-sm text-muted-foreground">
                  {{ run.reference || '—' }}
                </TableCell>
              </TableRow>
            </template>
            <TableRow v-else>
              <TableCell :colspan="6" class="h-20 text-center text-muted-foreground">
                No payment runs posted yet.
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  </div>
</template>
