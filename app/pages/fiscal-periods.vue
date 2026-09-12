<script setup lang="ts">
import { toast } from 'vue-sonner'

definePageMeta({
  middleware: 'finance',
})

const { periods, fetchPeriods, addPeriod, setPeriodStatus } = useFiscalPeriods()

onMounted(() => {
  fetchPeriods()
})

const newStartDate = ref('')
const newEndDate = ref('')
const newLabel = ref('')
const isAdding = ref(false)

async function onAddPeriod() {
  if (!newStartDate.value || !newEndDate.value)
    return

  isAdding.value = true
  try {
    await addPeriod({ startDate: newStartDate.value, endDate: newEndDate.value, label: newLabel.value.trim() || undefined })
    newStartDate.value = ''
    newEndDate.value = ''
    newLabel.value = ''
    toast('Fiscal period created')
  }
  catch (error: any) {
    toast.error('Could not create period', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
  finally {
    isAdding.value = false
  }
}

async function onToggleStatus(id: string, currentStatus: string) {
  await setPeriodStatus(id, currentStatus === 'open' ? 'closed' : 'open')
  toast(currentStatus === 'open' ? 'Period closed' : 'Period reopened')
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}
</script>

<template>
  <div class="w-full flex flex-col items-stretch gap-4">
    <div>
      <h2 class="text-2xl font-bold tracking-tight">
        Fiscal Periods
      </h2>
      <p class="text-muted-foreground">
        Journal entries post into the period covering their date — close a period to stop new postings.
      </p>
    </div>

    <div class="flex flex-wrap items-end gap-2 rounded-md border p-3">
      <div class="flex flex-col gap-1.5">
        <Label class="text-xs text-muted-foreground">Start</Label>
        <Input v-model="newStartDate" type="date" class="h-8 w-40 text-xs" />
      </div>
      <div class="flex flex-col gap-1.5">
        <Label class="text-xs text-muted-foreground">End</Label>
        <Input v-model="newEndDate" type="date" class="h-8 w-40 text-xs" />
      </div>
      <div class="flex flex-col gap-1.5">
        <Label class="text-xs text-muted-foreground">Label (optional)</Label>
        <Input v-model="newLabel" placeholder="e.g. September 2026" class="h-8 w-48 text-xs" />
      </div>
      <Button size="sm" :disabled="!newStartDate || !newEndDate || isAdding" @click="onAddPeriod">
        <Icon name="i-lucide-plus" class="mr-1.5 h-3.5 w-3.5" />
        New Period
      </Button>
    </div>

    <div class="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Period</TableHead>
            <TableHead>Range</TableHead>
            <TableHead>Status</TableHead>
            <TableHead class="w-32" />
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="periods.length">
            <TableRow v-for="period in periods" :key="period.id">
              <TableCell class="font-medium">
                {{ period.label }}
              </TableCell>
              <TableCell class="text-sm text-muted-foreground">
                {{ formatDate(period.startDate) }} – {{ formatDate(period.endDate) }}
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  :class="period.status === 'open'
                    ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30'
                    : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/15 dark:text-slate-400 dark:border-slate-500/30'"
                >
                  {{ period.status }}
                </Badge>
              </TableCell>
              <TableCell>
                <Button size="sm" variant="outline" @click="onToggleStatus(period.id, period.status)">
                  {{ period.status === 'open' ? 'Close' : 'Reopen' }}
                </Button>
              </TableCell>
            </TableRow>
          </template>
          <TableRow v-else>
            <TableCell :colspan="4" class="h-24 text-center">
              No fiscal periods yet — one is created automatically the first time a journal entry posts.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>
</template>
