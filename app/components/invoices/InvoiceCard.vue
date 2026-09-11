<script setup lang="ts">
import type { Invoice, InvoiceStatus, ReceiptMethod } from '~/types/invoice'
import { toast } from 'vue-sonner'

const props = defineProps<{
  invoice: Invoice
  clientId: string
  /** Show the invoice's client name (used on the cross-client Invoices page, not inside a Client sheet). */
  showClientName?: boolean
}>()

const { removeInvoice, addReceipt, removeReceipt } = useInvoices()

const invoiceStatusBadgeClass: Record<InvoiceStatus, string> = {
  unpaid: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30',
  partial: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30',
  paid: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30',
}

const RECEIPT_METHODS: { value: ReceiptMethod, label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
]

const receiptAmount = ref('')
const receiptMethod = ref<ReceiptMethod>('cash')
const receiptReference = ref('')

async function onRecordPayment() {
  if (!receiptAmount.value.trim())
    return

  try {
    await addReceipt(props.invoice.id, {
      amount: Number(receiptAmount.value),
      method: receiptMethod.value,
      reference: receiptReference.value.trim() || undefined,
    })
    receiptAmount.value = ''
    receiptReference.value = ''
    toast('Payment recorded')
  }
  catch (error: any) {
    toast.error('Could not record payment', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
}

async function onDeleteReceipt(receiptId: string) {
  await removeReceipt(props.invoice.id, receiptId)
  toast('Payment removed')
}

async function onDeleteInvoice() {
  await removeInvoice(props.clientId, props.invoice.id)
  toast('Invoice deleted')
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}
</script>

<template>
  <div class="flex flex-col gap-2 rounded-md border p-2 text-sm">
    <div class="flex items-center justify-between gap-2">
      <span class="font-medium truncate">
        {{ invoice.id }}
        <span v-if="showClientName && invoice.clientName" class="font-normal text-muted-foreground">· {{ invoice.clientName }}</span>
      </span>
      <Badge variant="outline" class="shrink-0" :class="invoiceStatusBadgeClass[invoice.status]">
        {{ invoice.status }}
      </Badge>
    </div>
    <div v-for="line in invoice.lineItems" :key="line.id" class="pl-2 text-xs text-muted-foreground">
      {{ line.description }} — {{ line.quantity }} × {{ line.unitPrice.toLocaleString() }} = {{ line.lineTotal.toLocaleString() }}
    </div>
    <p class="text-xs text-muted-foreground">
      Subtotal {{ invoice.subtotal.toLocaleString() }}
      <span v-if="invoice.taxRate"> · Tax {{ invoice.taxRate }}% ({{ invoice.taxAmount.toLocaleString() }})</span>
      <span v-if="invoice.discount"> · Discount {{ invoice.discount.toLocaleString() }}</span>
      · Total {{ invoice.total.toLocaleString() }} {{ invoice.currency }}
    </p>
    <p class="text-xs text-muted-foreground">
      Paid {{ invoice.amountPaid.toLocaleString() }} · Balance {{ invoice.balance.toLocaleString() }}
      <span v-if="invoice.dueAt"> · Due {{ formatDate(invoice.dueAt) }}</span>
    </p>

    <div v-for="receipt in invoice.receipts" :key="receipt.id" class="flex items-center gap-2 pl-2 text-xs text-muted-foreground">
      <Icon name="i-lucide-receipt" class="size-3 shrink-0" />
      <span class="flex-1">{{ formatDate(receipt.receivedAt) }} · {{ receipt.amount.toLocaleString() }} {{ invoice.currency }} · {{ RECEIPT_METHODS.find(m => m.value === receipt.method)?.label ?? 'Other' }}</span>
      <Button size="icon-sm" variant="ghost" class="size-5 shrink-0" @click="onDeleteReceipt(receipt.id)">
        <Icon name="i-lucide-x" class="size-3" />
      </Button>
    </div>

    <div v-if="invoice.status !== 'paid'" class="flex items-center gap-1.5 pt-1">
      <Input v-model="receiptAmount" type="number" min="0" step="0.01" placeholder="Amount" class="h-7 w-24 text-xs" />
      <Select v-model="receiptMethod">
        <SelectTrigger class="h-7 w-32 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="option in RECEIPT_METHODS" :key="option.value" :value="option.value">
            {{ option.label }}
          </SelectItem>
        </SelectContent>
      </Select>
      <Input v-model="receiptReference" placeholder="Reference (optional)" class="h-7 flex-1 text-xs" />
      <Button size="sm" variant="outline" class="h-7 shrink-0" @click="onRecordPayment">
        Record Payment
      </Button>
    </div>

    <div class="flex justify-end">
      <Button size="sm" variant="ghost" class="h-6 text-destructive" @click="onDeleteInvoice">
        Delete Invoice
      </Button>
    </div>
  </div>
</template>
