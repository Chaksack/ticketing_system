<script setup lang="ts">
import { toast } from 'vue-sonner'

definePageMeta({
  middleware: 'finance',
})

const { budgets, budgetVsActual, fetchBudgets, addBudget, removeBudget, fetchBudgetVsActual } = useBudgets()
const { accounts, fetchAccounts } = useAccounts()

function currentPeriodId() {
  return new Date().toISOString().slice(0, 7)
}

const periodId = ref(currentPeriodId())

async function refresh() {
  await Promise.all([fetchBudgets(periodId.value), fetchBudgetVsActual(periodId.value)])
}

onMounted(() => {
  fetchAccounts()
  refresh()
})

watch(periodId, () => refresh())

const budgetedCodes = computed(() => new Set(budgets.value.map(b => b.accountCode)))
const availableAccounts = computed(() => accounts.value.filter(a => !budgetedCodes.value.has(a.code)))

const isFormOpen = ref(false)
const newAccountCode = ref('')
const newAmount = ref('')
const newNotes = ref('')
const isSaving = ref(false)

async function onAddBudget() {
  if (!newAccountCode.value || !newAmount.value)
    return

  isSaving.value = true
  try {
    await addBudget({
      periodId: periodId.value,
      accountCode: newAccountCode.value,
      amount: Number(newAmount.value),
      notes: newNotes.value.trim() || undefined,
    })
    newAccountCode.value = ''
    newAmount.value = ''
    newNotes.value = ''
    isFormOpen.value = false
    await fetchBudgetVsActual(periodId.value)
    toast('Budget line added')
  }
  catch (error: any) {
    toast.error('Could not add budget line', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
  finally {
    isSaving.value = false
  }
}

async function onRemoveBudget(id: string) {
  try {
    await removeBudget(id)
    await fetchBudgetVsActual(periodId.value)
    toast('Budget line removed')
  }
  catch (error: any) {
    toast.error('Could not remove budget line', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
}

function formatCurrency(amount: number) {
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Over-budget reads as bad for an expense but good for revenue — everything else (asset/liability/equity budgets) is neutral, shown plain.
function varianceClass(row: { type: string, variance: number }) {
  if (row.variance === 0)
    return 'text-muted-foreground'
  if (row.type === 'expense')
    return row.variance > 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'
  if (row.type === 'revenue')
    return row.variance < 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'
  return ''
}
</script>

<template>
  <div class="w-full flex flex-col items-stretch gap-4">
    <div class="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">
          Budgets
        </h2>
        <p class="text-muted-foreground">
          Set a target per account per month, and track it against what actually posted.
        </p>
      </div>
      <div class="flex items-end gap-2">
        <div class="flex flex-col gap-1.5">
          <Label for="budget-period" class="text-xs text-muted-foreground">Period</Label>
          <Input id="budget-period" v-model="periodId" type="month" class="h-9 w-40" />
        </div>
        <Button @click="isFormOpen = !isFormOpen">
          <Icon name="i-lucide-plus" class="mr-2 h-4 w-4" />
          Add Budget Line
        </Button>
      </div>
    </div>

    <div v-if="isFormOpen" class="flex flex-col gap-3 rounded-md border p-4">
      <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div class="flex flex-col gap-1.5">
          <Label class="text-xs text-muted-foreground">Account</Label>
          <Select v-model="newAccountCode">
            <SelectTrigger class="h-8 text-xs">
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="account in availableAccounts" :key="account.code" :value="account.code">
                {{ account.code }} — {{ account.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="flex flex-col gap-1.5">
          <Label class="text-xs text-muted-foreground">Budgeted Amount</Label>
          <Input v-model="newAmount" type="number" min="0" step="0.01" placeholder="0.00" class="h-8 text-xs" />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label class="text-xs text-muted-foreground">Notes (optional)</Label>
          <Input v-model="newNotes" placeholder="What is this target for?" class="h-8 text-xs" />
        </div>
      </div>
      <div class="flex justify-end">
        <Button size="sm" :disabled="!newAccountCode || !newAmount || isSaving" @click="onAddBudget">
          Save Budget Line
        </Button>
      </div>
    </div>

    <div class="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Account</TableHead>
            <TableHead class="text-right">
              Budget
            </TableHead>
            <TableHead class="text-right">
              Actual
            </TableHead>
            <TableHead class="text-right">
              Variance
            </TableHead>
            <TableHead class="text-right">
              Variance %
            </TableHead>
            <TableHead class="w-16" />
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="budgetVsActual.length">
            <TableRow v-for="row in budgetVsActual" :key="row.accountCode">
              <TableCell class="font-medium">
                {{ row.accountName }}
              </TableCell>
              <TableCell class="text-right tabular-nums">
                {{ formatCurrency(row.budget) }}
              </TableCell>
              <TableCell class="text-right tabular-nums">
                {{ formatCurrency(row.actual) }}
              </TableCell>
              <TableCell class="text-right tabular-nums" :class="varianceClass(row)">
                {{ formatCurrency(row.variance) }}
              </TableCell>
              <TableCell class="text-right tabular-nums" :class="varianceClass(row)">
                {{ row.variancePct === null ? '—' : `${row.variancePct.toFixed(1)}%` }}
              </TableCell>
              <TableCell>
                <Button
                  size="icon-sm" variant="ghost" class="text-destructive"
                  @click="onRemoveBudget(budgets.find(b => b.accountCode === row.accountCode)?.id ?? '')"
                >
                  <Icon name="i-lucide-trash-2" class="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          </template>
          <TableRow v-else>
            <TableCell :colspan="6" class="h-24 text-center">
              No budget lines set for this period yet.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>
</template>
