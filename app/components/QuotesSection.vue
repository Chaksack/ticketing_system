<script setup lang="ts">
import type { NewQuoteLineItem } from '~/composables/useQuotes'
import type { RegardingType } from '~/types/interaction'
import type { QuoteStatus } from '~/types/quote'
import { toast } from 'vue-sonner'
import { downloadQuotePdf } from '~/lib/quotePdf'

const props = defineProps<{
  regardingType: RegardingType
  regardingId: string
  recordName: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
}>()

const { quotes, fetchQuotes, addQuote, updateQuoteStatus, removeQuote } = useQuotes()
const { products, fetchProducts } = useProducts()

const isLoading = ref(false)

async function reload() {
  isLoading.value = true
  try {
    await fetchQuotes(props.regardingType, props.regardingId)
  }
  finally {
    isLoading.value = false
  }
}

onMounted(() => {
  reload()
  if (!products.value.length)
    fetchProducts()
})

const STATUS_OPTIONS: { value: QuoteStatus, label: string }[] = [
  { value: 'quoted', label: 'Quoted' },
  { value: 'ordered', label: 'Ordered' },
  { value: 'invoiced', label: 'Invoiced' },
]

const statusBadgeClass: Record<QuoteStatus, string> = {
  quoted: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/15 dark:text-slate-400 dark:border-slate-500/30',
  ordered: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30',
  invoiced: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30',
}

const isFormOpen = ref(false)
const draftLineItems = ref<NewQuoteLineItem[]>([])
const draftNotes = ref('')
const isSaving = ref(false)

function onAddDraftLine(item: NewQuoteLineItem) {
  draftLineItems.value = [...draftLineItems.value, item]
}

function onRemoveDraftLine(_item: unknown, index: number) {
  draftLineItems.value = draftLineItems.value.filter((_, i) => i !== index)
}

async function onCreateQuote() {
  if (!draftLineItems.value.length) {
    toast.error('Add at least one line item')
    return
  }

  isSaving.value = true
  try {
    await addQuote({
      regardingType: props.regardingType,
      regardingId: props.regardingId,
      notes: draftNotes.value.trim() || undefined,
      lineItems: draftLineItems.value,
    })
    draftLineItems.value = []
    draftNotes.value = ''
    isFormOpen.value = false
    toast('Quote created')
  }
  catch (error: any) {
    toast.error('Could not create quote', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
  finally {
    isSaving.value = false
  }
}

async function onStatusChange(id: string, status: QuoteStatus) {
  await updateQuoteStatus(id, status)
  toast('Quote status updated')
}

async function onDelete(id: string) {
  await removeQuote(id)
  toast('Quote deleted')
}

async function onDownload(quoteId: string) {
  const quote = quotes.value.find(q => q.id === quoteId)
  if (!quote)
    return

  await downloadQuotePdf(quote, {
    recordName: props.recordName,
    contactName: props.contactName,
    contactEmail: props.contactEmail,
    contactPhone: props.contactPhone,
  })
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <h4 class="text-sm font-medium flex items-center justify-between">
      <span>Quotes</span>
      <Button size="sm" variant="outline" @click="isFormOpen = !isFormOpen">
        <Icon name="i-lucide-plus" class="mr-1.5 h-3.5 w-3.5" />
        New Quote
      </Button>
    </h4>

    <div v-if="isFormOpen" class="flex flex-col gap-2 rounded-md border p-3">
      <LineItemsEditor
        :line-items="draftLineItems"
        :product-catalog="products"
        @add="onAddDraftLine"
        @remove="onRemoveDraftLine"
      />
      <Textarea v-model="draftNotes" rows="2" placeholder="Notes for this quote (optional)" />
      <div class="flex justify-end">
        <Button size="sm" :disabled="isSaving" @click="onCreateQuote">
          Create Quote
        </Button>
      </div>
    </div>

    <p v-if="!quotes.length && !isLoading" class="text-sm text-muted-foreground">
      No quotes yet.
    </p>
    <div v-for="quote in quotes" :key="quote.id" class="flex flex-col gap-1.5 rounded-md border p-2 text-sm">
      <div class="flex items-center justify-between gap-2">
        <span class="font-medium">{{ quote.id }}</span>
        <Select :model-value="quote.status" @update:model-value="(v) => onStatusChange(quote.id, v as QuoteStatus)">
          <SelectTrigger class="h-7 w-auto gap-1.5 px-2 text-xs">
            <Badge variant="outline" class="border-0 p-0" :class="statusBadgeClass[quote.status]">
              {{ STATUS_OPTIONS.find(o => o.value === quote.status)?.label }}
            </Badge>
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="option in STATUS_OPTIONS" :key="option.value" :value="option.value">
              {{ option.label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <span class="text-xs text-muted-foreground">{{ formatDate(quote.createdAt) }} · {{ quote.lineItems.length }} item(s) · Total {{ quote.total.toLocaleString() }}</span>
      <div class="flex items-center justify-end gap-1">
        <Button size="sm" variant="outline" @click="onDownload(quote.id)">
          <Icon name="i-lucide-download" class="mr-1.5 size-3.5" />
          Download PDF
        </Button>
        <Button size="icon-sm" variant="ghost" class="text-destructive" @click="onDelete(quote.id)">
          <Icon name="i-lucide-trash-2" class="size-3.5" />
        </Button>
      </div>
    </div>
  </div>
</template>
