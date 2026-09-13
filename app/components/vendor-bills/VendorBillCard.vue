<script setup lang="ts">
import type { VendorBill, VendorBillStatus, VendorPaymentMethod } from '~/types/vendor-bill'
import { toast } from 'vue-sonner'

const props = defineProps<{
  bill: VendorBill
  /** Show the bill's vendor name (used on the cross-vendor Vendor Bills page, not inside a Vendor sheet). */
  showVendorName?: boolean
}>()

const { removeBill, addPayment, removePayment } = useVendorBills()

const STATUS_BADGE_CLASS: Record<VendorBillStatus, string> = {
  unpaid: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30',
  partial: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30',
  paid: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30',
}

const PAYMENT_METHODS: { value: VendorPaymentMethod, label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
]

const paymentAmount = ref('')
const paymentMethod = ref<VendorPaymentMethod>('bank_transfer')
const paymentReference = ref('')

async function onRecordPayment() {
  if (!paymentAmount.value.trim())
    return

  try {
    await addPayment(props.bill.id, {
      amount: Number(paymentAmount.value),
      method: paymentMethod.value,
      reference: paymentReference.value.trim() || undefined,
    })
    paymentAmount.value = ''
    paymentReference.value = ''
    toast('Payment recorded')
  }
  catch (error: any) {
    toast.error('Could not record payment', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
}

async function onDeletePayment(paymentId: string) {
  await removePayment(props.bill.id, paymentId)
  toast('Payment removed')
}

async function onDeleteBill() {
  await removeBill(props.bill.id)
  toast('Vendor bill deleted')
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}
</script>

<template>
  <div class="flex flex-col gap-2 rounded-md border p-2 text-sm">
    <div class="flex items-center justify-between gap-2">
      <span class="font-medium truncate">
        {{ bill.id }}
        <span v-if="showVendorName && bill.vendorName" class="font-normal text-muted-foreground">· {{ bill.vendorName }}</span>
      </span>
      <Badge variant="outline" class="shrink-0" :class="STATUS_BADGE_CLASS[bill.status]">
        {{ bill.status }}
      </Badge>
    </div>
    <div v-for="line in bill.lineItems" :key="line.id" class="pl-2 text-xs text-muted-foreground">
      {{ line.description }} — {{ line.quantity }} × {{ line.unitPrice.toLocaleString() }} = {{ line.lineTotal.toLocaleString() }}
    </div>
    <p class="text-xs text-muted-foreground">
      Subtotal {{ bill.subtotal.toLocaleString() }}
      <span v-if="bill.taxRate"> · Tax {{ bill.taxRate }}% ({{ bill.taxAmount.toLocaleString() }})</span>
      · Total {{ bill.total.toLocaleString() }} {{ bill.currency }}
      · Debits {{ bill.expenseAccountName ?? bill.expenseAccountCode }}
    </p>
    <p class="text-xs text-muted-foreground">
      Paid {{ bill.amountPaid.toLocaleString() }} · Balance {{ bill.balance.toLocaleString() }}
      <span v-if="bill.dueAt"> · Due {{ formatDate(bill.dueAt) }}</span>
      <span v-if="bill.reference"> · Ref {{ bill.reference }}</span>
    </p>

    <div v-for="payment in bill.payments" :key="payment.id" class="flex items-center gap-2 pl-2 text-xs text-muted-foreground">
      <Icon name="i-lucide-banknote" class="size-3 shrink-0" />
      <span class="flex-1">{{ formatDate(payment.paidAt) }} · {{ payment.amount.toLocaleString() }} {{ bill.currency }} · {{ PAYMENT_METHODS.find(m => m.value === payment.method)?.label ?? 'Other' }}</span>
      <Button size="icon-sm" variant="ghost" class="size-5 shrink-0" @click="onDeletePayment(payment.id)">
        <Icon name="i-lucide-x" class="size-3" />
      </Button>
    </div>

    <div v-if="bill.status !== 'paid'" class="flex items-center gap-1.5 pt-1">
      <Input v-model="paymentAmount" type="number" min="0" step="0.01" placeholder="Amount" class="h-7 w-24 text-xs" />
      <Select v-model="paymentMethod">
        <SelectTrigger class="h-7 w-32 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="option in PAYMENT_METHODS" :key="option.value" :value="option.value">
            {{ option.label }}
          </SelectItem>
        </SelectContent>
      </Select>
      <Input v-model="paymentReference" placeholder="Reference (optional)" class="h-7 flex-1 text-xs" />
      <Button size="sm" variant="outline" class="h-7 shrink-0" @click="onRecordPayment">
        Record Payment
      </Button>
    </div>

    <div class="flex justify-end">
      <Button size="sm" variant="ghost" class="h-6 text-destructive" @click="onDeleteBill">
        Delete Bill
      </Button>
    </div>
  </div>
</template>
