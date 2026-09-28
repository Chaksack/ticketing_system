<script setup lang="ts">
import type { Project, ProjectFinancialEntry, ProjectFinancialEntryKind } from '~/types/project'
import { toast } from 'vue-sonner'
import { parseAmountInput } from '~/lib/formNumbers'

const props = defineProps<{
  project: Project
}>()

const { updateProject, addFinancialEntry, removeFinancialEntry } = useProjects()

function money(value: number | undefined) {
  if (value === undefined)
    return '—'
  return `${props.project.currency} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const paidPct = computed(() => {
  const value = props.project.contractValue
  return value ? Math.min(100, Math.round((props.project.amountPaid / value) * 100)) : 0
})

const costs = computed(() => props.project.financialEntries.filter(entry => entry.kind === 'cost'))
const payments = computed(() => props.project.financialEntries.filter(entry => entry.kind === 'payment'))

// Project value + currency
const isEditingValue = ref(false)
const valueDraft = ref('')
const currencyDraft = ref('')
const isSavingValue = ref(false)

function startEditValue() {
  valueDraft.value = props.project.contractValue?.toString() ?? ''
  currencyDraft.value = props.project.currency
  isEditingValue.value = true
}

async function onSaveValue() {
  const value = parseAmountInput(valueDraft.value) ?? null
  if (value !== null && value < 0) {
    toast.error('Enter a valid amount')
    return
  }
  isSavingValue.value = true
  try {
    await updateProject(props.project.id, { contractValue: value, currency: currencyDraft.value.trim() || 'GHS' })
    isEditingValue.value = false
    toast('Project value saved')
  }
  catch (error: any) {
    toast.error('Could not save project value', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
  finally {
    isSavingValue.value = false
  }
}

// Add cost / payment
const openForm = ref<ProjectFinancialEntryKind | null>(null)
const entryAmount = ref('')
const entryDate = ref('')
const entryDescription = ref('')
const entryReference = ref('')
const isSavingEntry = ref(false)

function toggleForm(kind: ProjectFinancialEntryKind) {
  openForm.value = openForm.value === kind ? null : kind
  entryAmount.value = ''
  entryDate.value = new Date().toISOString().slice(0, 10)
  entryDescription.value = ''
  entryReference.value = ''
}

const canSaveEntry = computed(() => Number(entryAmount.value) > 0 && (openForm.value !== 'cost' || !!entryDescription.value.trim()))

async function onSaveEntry() {
  if (!openForm.value || !canSaveEntry.value)
    return
  const kind = openForm.value
  isSavingEntry.value = true
  try {
    await addFinancialEntry(props.project.id, {
      kind,
      amount: Number(entryAmount.value),
      entryDate: entryDate.value || undefined,
      description: entryDescription.value.trim() || undefined,
      reference: entryReference.value.trim() || undefined,
    })
    openForm.value = null
    toast(kind === 'cost' ? 'Cost added' : 'Payment recorded')
  }
  catch (error: any) {
    toast.error(kind === 'cost' ? 'Could not add cost' : 'Could not record payment', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
  finally {
    isSavingEntry.value = false
  }
}

async function onRemoveEntry(entry: ProjectFinancialEntry) {
  try {
    await removeFinancialEntry(props.project.id, entry.id)
    toast(entry.kind === 'cost' ? 'Cost removed' : 'Payment removed')
  }
  catch (error: any) {
    toast.error('Could not remove entry', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <h4 class="text-sm font-medium flex items-center justify-between">
      <span>Financials</span>
      <Button v-if="!isEditingValue" size="sm" variant="outline" @click="startEditValue">
        <Icon name="i-lucide-pencil" class="mr-1.5 h-3.5 w-3.5" />
        {{ project.contractValue === undefined ? 'Set Project Value' : 'Edit Value' }}
      </Button>
    </h4>

    <div v-if="isEditingValue" class="flex flex-col gap-2 rounded-md border p-2">
      <Label class="text-xs text-muted-foreground">Project value (what the client pays)</Label>
      <div class="grid grid-cols-[5rem_1fr] gap-2">
        <Input v-model="currencyDraft" placeholder="GHS" class="h-8 text-xs uppercase" />
        <Input v-model="valueDraft" type="number" min="0" step="0.01" placeholder="e.g. 250000" class="h-8 text-xs" />
      </div>
      <div class="flex justify-end gap-2">
        <Button size="sm" variant="ghost" @click="isEditingValue = false">
          Cancel
        </Button>
        <Button size="sm" :disabled="isSavingValue" @click="onSaveValue">
          Save
        </Button>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
      <div class="flex flex-col gap-0.5 rounded-md border p-2">
        <span class="text-xs text-muted-foreground">Project value</span>
        <span class="tabular-nums font-medium">{{ money(project.contractValue) }}</span>
      </div>
      <div class="flex flex-col gap-0.5 rounded-md border p-2">
        <span class="text-xs text-muted-foreground">Total cost</span>
        <span class="tabular-nums font-medium">{{ money(project.totalCost) }}</span>
      </div>
      <div class="flex flex-col gap-0.5 rounded-md border p-2">
        <span class="text-xs text-muted-foreground">Income margin</span>
        <span
          class="tabular-nums font-medium"
          :class="project.margin === undefined ? '' : project.margin < 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'"
        >
          {{ money(project.margin) }}
          <span v-if="project.marginPct !== undefined" class="text-xs font-normal text-muted-foreground">({{ project.marginPct.toFixed(1) }}%)</span>
        </span>
      </div>
      <div class="flex flex-col gap-0.5 rounded-md border p-2">
        <span class="text-xs text-muted-foreground">Paid</span>
        <span class="tabular-nums font-medium">{{ money(project.amountPaid) }}</span>
      </div>
      <div class="flex flex-col gap-0.5 rounded-md border p-2 sm:col-span-2">
        <span class="text-xs text-muted-foreground">{{ project.amountDue !== undefined && project.amountDue < 0 ? 'Overpaid' : 'Amount due' }}</span>
        <span
          class="tabular-nums font-medium"
          :class="project.amountDue !== undefined && project.amountDue > 0 ? 'text-amber-600 dark:text-amber-400' : ''"
        >
          {{ money(project.amountDue === undefined ? undefined : Math.abs(project.amountDue)) }}
        </span>
      </div>
    </div>

    <div v-if="project.contractValue" class="flex flex-col gap-1">
      <Progress :model-value="paidPct" class="h-2" />
      <span class="text-xs text-muted-foreground">{{ paidPct }}% paid</span>
    </div>
    <p v-else class="text-xs text-muted-foreground">
      Set the project value to see the margin and how much is still due.
    </p>

    <!-- Costs -->
    <div class="flex flex-col gap-2 rounded-md border p-2">
      <div class="flex items-center justify-between">
        <span class="text-xs font-medium">Costs ({{ costs.length }})</span>
        <Button size="sm" variant="outline" class="h-7 text-xs" @click="toggleForm('cost')">
          <Icon name="i-lucide-plus" class="mr-1 size-3.5" />
          Add Cost
        </Button>
      </div>
      <div v-if="openForm === 'cost'" class="flex flex-col gap-2 rounded-md bg-muted/30 p-2">
        <Input v-model="entryDescription" placeholder="What was it for? e.g. Cabling materials" class="h-8 text-xs" />
        <div class="grid grid-cols-3 gap-2">
          <Input v-model="entryAmount" type="number" min="0" step="0.01" :placeholder="`Amount (${project.currency})`" class="h-8 text-xs" />
          <Input v-model="entryDate" type="date" class="h-8 text-xs" />
          <Input v-model="entryReference" placeholder="Supplier / ref (optional)" class="h-8 text-xs" />
        </div>
        <div class="flex justify-end">
          <Button size="sm" :disabled="!canSaveEntry || isSavingEntry" @click="onSaveEntry">
            Save Cost
          </Button>
        </div>
      </div>
      <p v-if="!costs.length" class="text-xs text-muted-foreground">
        No costs recorded yet.
      </p>
      <div v-for="entry in costs" :key="entry.id" class="flex items-center gap-2 text-xs">
        <span class="w-24 shrink-0 text-muted-foreground">{{ formatDate(entry.entryDate) }}</span>
        <span class="flex-1 truncate">
          {{ entry.description }}<span v-if="entry.reference" class="text-muted-foreground"> · {{ entry.reference }}</span>
        </span>
        <span class="shrink-0 tabular-nums font-medium">{{ money(entry.amount) }}</span>
        <Button size="icon-sm" variant="ghost" class="size-6 shrink-0 text-destructive" title="Remove" @click="onRemoveEntry(entry)">
          <Icon name="i-lucide-trash-2" class="size-3.5" />
        </Button>
      </div>
    </div>

    <!-- Payments -->
    <div class="flex flex-col gap-2 rounded-md border p-2">
      <div class="flex items-center justify-between">
        <span class="text-xs font-medium">Payments received ({{ payments.length }})</span>
        <Button size="sm" variant="outline" class="h-7 text-xs" @click="toggleForm('payment')">
          <Icon name="i-lucide-plus" class="mr-1 size-3.5" />
          Record Payment
        </Button>
      </div>
      <div v-if="openForm === 'payment'" class="flex flex-col gap-2 rounded-md bg-muted/30 p-2">
        <div class="grid grid-cols-3 gap-2">
          <Input v-model="entryAmount" type="number" min="0" step="0.01" :placeholder="`Amount (${project.currency})`" class="h-8 text-xs" />
          <Input v-model="entryDate" type="date" class="h-8 text-xs" />
          <Input v-model="entryReference" placeholder="Receipt / cheque no." class="h-8 text-xs" />
        </div>
        <Input v-model="entryDescription" placeholder="Note (optional), e.g. 2nd installment" class="h-8 text-xs" />
        <div class="flex justify-end">
          <Button size="sm" :disabled="!canSaveEntry || isSavingEntry" @click="onSaveEntry">
            Save Payment
          </Button>
        </div>
      </div>
      <p v-if="!payments.length" class="text-xs text-muted-foreground">
        No payments recorded yet.
      </p>
      <div v-for="entry in payments" :key="entry.id" class="flex items-center gap-2 text-xs">
        <span class="w-24 shrink-0 text-muted-foreground">{{ formatDate(entry.entryDate) }}</span>
        <span class="flex-1 truncate">
          {{ entry.description || 'Payment' }}<span v-if="entry.reference" class="text-muted-foreground"> · {{ entry.reference }}</span>
        </span>
        <span class="shrink-0 tabular-nums font-medium text-emerald-600 dark:text-emerald-400">{{ money(entry.amount) }}</span>
        <Button size="icon-sm" variant="ghost" class="size-6 shrink-0 text-destructive" title="Remove" @click="onRemoveEntry(entry)">
          <Icon name="i-lucide-trash-2" class="size-3.5" />
        </Button>
      </div>
    </div>
  </div>
</template>
