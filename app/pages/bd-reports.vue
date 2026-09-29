<script setup lang="ts">
import { toast } from 'vue-sonner'
import { downloadBdReportPdf } from '~/lib/bdReportPdf'
import { formatProjectMoney } from '~/types/project'

definePageMeta({
  middleware: 'bd',
})

const { summary, isLoading, fetchSummary } = useBdReports()
const { progress: quotaProgress, fetchProgress } = useBdQuotas()
const { status: modelStatus, isTraining, fetchStatus: fetchModelStatus, retrain: retrainModel } = useConversionModel()

async function onRetrainModel() {
  try {
    const result = await retrainModel()

    if (!result.trained) {
      toast('Not enough decided deals to train yet', {
        description: `${result.trainingExamples} of ${result.minTrainingExamples} needed decided deals so far.`,
      })
      return
    }

    const accuracyNote = result.accuracy !== null ? ` — ${Math.round(result.accuracy * 100)}% held-out accuracy` : ''
    toast('Conversion model retrained', {
      description: `Trained on ${result.trainingExamples} decided deals${accuracyNote}.`,
    })
  }
  catch (error: any) {
    toast.error('Could not retrain model', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
}

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10)
}

const from = ref('')
const to = ref('')

async function refresh() {
  await fetchSummary({ from: from.value, to: to.value })
}

const quotaScope = ref<'month' | 'year'>('month')

function currentPeriod() {
  const now = new Date()
  return quotaScope.value === 'year'
    ? String(now.getFullYear())
    : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

watch(quotaScope, () => fetchProgress(currentPeriod()))

onMounted(() => {
  const today = new Date()
  from.value = toDateInput(new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000))
  to.value = toDateInput(today)
  refresh()
  fetchProgress(currentPeriod())
  fetchModelStatus()
})

function applyPreset(days: number) {
  const end = new Date()
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000)
  from.value = toDateInput(start)
  to.value = toDateInput(end)
  refresh()
}

const isDownloading = ref(false)

async function onDownloadPdf() {
  if (!summary.value)
    return

  isDownloading.value = true
  try {
    await downloadBdReportPdf(summary.value, {
      label: quotaScope.value === 'year' ? `${new Date().getFullYear()}` : new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
      progress: quotaProgress.value,
    })
  }
  catch (error: any) {
    toast.error('Could not generate PDF', {
      description: error?.message ?? 'Something went wrong. Please try again.',
    })
  }
  finally {
    isDownloading.value = false
  }
}

function titleCase(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const leadsByStageData = computed(() => summary.value?.leads.byStage.map(row => ({ stage: titleCase(row.stage), count: row.count })) ?? [])
const tendersByStageData = computed(() => summary.value?.tenders.byStage.map(row => ({ stage: titleCase(row.stage), count: row.count })) ?? [])
const clientsByStageData = computed(() => summary.value?.clients.byStage.map(row => ({ stage: titleCase(row.stage), count: row.count })) ?? [])
const amcByStatusData = computed(() => summary.value?.amc.byStatus.map(row => ({ status: titleCase(row.status), count: row.count })) ?? [])
const calendarByTypeData = computed(() => summary.value?.calendar.byType.map(row => ({ type: row.type, count: row.count })) ?? [])

function money(currency: string, value?: number) {
  return value === undefined ? '—' : formatProjectMoney(currency, value, 0)
}

const REGARDING_LABEL: Record<string, string> = { lead: 'Lead', tender: 'Tender', client: 'Client', unlinked: 'Not linked' }

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function formatDay(value: string) {
  return new Date(value.length === 10 ? `${value}T00:00:00` : value).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

function daysUntil(value: string) {
  const days = Math.ceil((new Date(value.length === 10 ? `${value}T23:59:59` : value).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
  return days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`
}
</script>

<template>
  <div class="w-full flex flex-col gap-4">
    <div class="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">
          BD &amp; SM Reports
        </h2>
        <p class="text-muted-foreground">
          Pipeline, calendar activity, rep performance, quotes, project payments and what's coming up, over a date range.
        </p>
      </div>
      <Button :disabled="!summary || isDownloading" @click="onDownloadPdf">
        <Icon name="i-lucide-download" class="mr-2 h-4 w-4" />
        {{ isDownloading ? 'Generating…' : 'Download PDF' }}
      </Button>
    </div>

    <div class="flex flex-wrap items-end gap-2">
      <div class="flex flex-col gap-1.5">
        <Label class="text-xs text-muted-foreground">From</Label>
        <Input v-model="from" type="date" class="w-auto" @change="refresh" />
      </div>
      <div class="flex flex-col gap-1.5">
        <Label class="text-xs text-muted-foreground">To</Label>
        <Input v-model="to" type="date" class="w-auto" @change="refresh" />
      </div>
      <div class="flex items-center gap-1.5 pb-0.5">
        <Button size="sm" variant="outline" @click="applyPreset(7)">
          Last 7 days
        </Button>
        <Button size="sm" variant="outline" @click="applyPreset(30)">
          Last 30 days
        </Button>
        <Button size="sm" variant="outline" @click="applyPreset(90)">
          Last 90 days
        </Button>
      </div>
    </div>

    <main class="@container/main flex flex-1 flex-col gap-4 md:gap-8">
      <div class="flex flex-col gap-2">
        <h3 class="text-sm font-medium text-muted-foreground">
          Leads
        </h3>
        <div class="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs @xl/main:grid-cols-3 @3xl/main:grid-cols-5">
          <Card class="@container/card">
            <CardHeader>
              <CardDescription>New Leads</CardDescription>
              <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                <NumberFlow :value="summary?.leads.newCount ?? 0" />
              </CardTitle>
            </CardHeader>
          </Card>
          <Card class="@container/card">
            <CardHeader>
              <CardDescription>Converted</CardDescription>
              <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                <NumberFlow :value="summary?.leads.convertedCount ?? 0" />
              </CardTitle>
            </CardHeader>
          </Card>
          <Card class="@container/card">
            <CardHeader>
              <CardDescription>Conversion Rate</CardDescription>
              <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                <NumberFlow :value="summary?.leads.conversionRate ?? 0" suffix="%" />
              </CardTitle>
            </CardHeader>
          </Card>
          <Card class="@container/card">
            <CardHeader>
              <CardDescription>Pipeline Value</CardDescription>
              <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                <NumberFlow :value="summary?.leads.estimatedValueTotal ?? 0" />
              </CardTitle>
            </CardHeader>
          </Card>
          <Card class="@container/card">
            <CardHeader>
              <CardDescription>Weighted Value</CardDescription>
              <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                <NumberFlow :value="summary?.leads.weightedValueTotal ?? 0" />
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
        <div class="grid grid-cols-1 gap-4 @xl/main:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>By Stage</CardTitle>
            </CardHeader>
            <CardContent>
              <p v-if="!leadsByStageData.length" class="text-sm text-muted-foreground">
                No leads in this range.
              </p>
              <DonutChart v-else :data="leadsByStageData" category="count" index="stage" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>By Source</CardTitle>
            </CardHeader>
            <CardContent>
              <p v-if="!summary?.leads.bySource.length" class="text-sm text-muted-foreground">
                No leads in this range.
              </p>
              <BarChart v-else :data="summary.leads.bySource" :categories="['count']" index="source" />
            </CardContent>
          </Card>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <h3 class="text-sm font-medium text-muted-foreground">
          Tenders
        </h3>
        <div class="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs @xl/main:grid-cols-3 @3xl/main:grid-cols-5">
          <Card class="@container/card">
            <CardHeader>
              <CardDescription>New Tenders</CardDescription>
              <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                <NumberFlow :value="summary?.tenders.newCount ?? 0" />
              </CardTitle>
            </CardHeader>
          </Card>
          <Card class="@container/card">
            <CardHeader>
              <CardDescription>Won</CardDescription>
              <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                <NumberFlow :value="summary?.tenders.convertedCount ?? 0" />
              </CardTitle>
            </CardHeader>
          </Card>
          <Card class="@container/card">
            <CardHeader>
              <CardDescription>Win Rate</CardDescription>
              <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                <NumberFlow :value="summary?.tenders.conversionRate ?? 0" suffix="%" />
              </CardTitle>
            </CardHeader>
          </Card>
          <Card class="@container/card">
            <CardHeader>
              <CardDescription>Pipeline Value</CardDescription>
              <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                <NumberFlow :value="summary?.tenders.estimatedValueTotal ?? 0" />
              </CardTitle>
            </CardHeader>
          </Card>
          <Card class="@container/card">
            <CardHeader>
              <CardDescription>Weighted Value</CardDescription>
              <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                <NumberFlow :value="summary?.tenders.weightedValueTotal ?? 0" />
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
        <div class="grid grid-cols-1 gap-4 @xl/main:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>By Stage</CardTitle>
            </CardHeader>
            <CardContent>
              <p v-if="!tendersByStageData.length" class="text-sm text-muted-foreground">
                No tenders in this range.
              </p>
              <DonutChart v-else :data="tendersByStageData" category="count" index="stage" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>By Source</CardTitle>
            </CardHeader>
            <CardContent>
              <p v-if="!summary?.tenders.bySource.length" class="text-sm text-muted-foreground">
                No tenders in this range.
              </p>
              <BarChart v-else :data="summary.tenders.bySource" :categories="['count']" index="source" />
            </CardContent>
          </Card>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <h3 class="text-sm font-medium text-muted-foreground">
          Forecast
        </h3>
        <div class="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs @xl/main:grid-cols-3 @3xl/main:grid-cols-6">
          <Card class="@container/card">
            <CardHeader>
              <CardDescription>Lead Win Rate</CardDescription>
              <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                <NumberFlow v-if="summary?.leads.winRate !== null && summary?.leads.winRate !== undefined" :value="summary.leads.winRate" suffix="%" />
                <span v-else class="text-base text-muted-foreground">No decided deals</span>
              </CardTitle>
            </CardHeader>
          </Card>
          <Card class="@container/card">
            <CardHeader>
              <CardDescription>Avg Lead Deal Size</CardDescription>
              <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                <NumberFlow v-if="summary?.leads.averageDealSize !== null && summary?.leads.averageDealSize !== undefined" :value="summary.leads.averageDealSize" />
                <span v-else class="text-base text-muted-foreground">—</span>
              </CardTitle>
            </CardHeader>
          </Card>
          <Card class="@container/card">
            <CardHeader>
              <CardDescription>Avg Lead Sales Cycle</CardDescription>
              <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                <NumberFlow v-if="summary?.leads.avgSalesCycleDays !== null && summary?.leads.avgSalesCycleDays !== undefined" :value="summary.leads.avgSalesCycleDays" suffix=" days" />
                <span v-else class="text-base text-muted-foreground">—</span>
              </CardTitle>
            </CardHeader>
          </Card>
          <Card class="@container/card">
            <CardHeader>
              <CardDescription>Tender Win Rate</CardDescription>
              <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                <NumberFlow v-if="summary?.tenders.winRate !== null && summary?.tenders.winRate !== undefined" :value="summary.tenders.winRate" suffix="%" />
                <span v-else class="text-base text-muted-foreground">No decided deals</span>
              </CardTitle>
            </CardHeader>
          </Card>
          <Card class="@container/card">
            <CardHeader>
              <CardDescription>Avg Tender Deal Size</CardDescription>
              <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                <NumberFlow v-if="summary?.tenders.averageDealSize !== null && summary?.tenders.averageDealSize !== undefined" :value="summary.tenders.averageDealSize" />
                <span v-else class="text-base text-muted-foreground">—</span>
              </CardTitle>
            </CardHeader>
          </Card>
          <Card class="@container/card">
            <CardHeader>
              <CardDescription>Avg Tender Sales Cycle</CardDescription>
              <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                <NumberFlow v-if="summary?.tenders.avgSalesCycleDays !== null && summary?.tenders.avgSalesCycleDays !== undefined" :value="summary.tenders.avgSalesCycleDays" suffix=" days" />
                <span v-else class="text-base text-muted-foreground">—</span>
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Won Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <p v-if="!summary?.trend.length" class="text-sm text-muted-foreground">
              No won deals in this range.
            </p>
            <AreaChart v-else :data="summary.trend" :categories="['leadsWon', 'tendersWon']" index="date" />
          </CardContent>
        </Card>
      </div>

      <div class="flex flex-col gap-2">
        <h3 class="text-sm font-medium text-muted-foreground">
          Conversion Model
        </h3>
        <p class="text-xs text-muted-foreground -mt-1">
          An in-house model trained on your own decided leads and tenders — it predicts win probability and surfaces as an AI suggestion on each lead/tender/client. Retrains automatically overnight; use this to refresh it immediately after a data change.
        </p>
        <Card>
          <CardContent class="flex flex-wrap items-center justify-between gap-3 pt-6">
            <div class="flex flex-col gap-1 text-sm">
              <template v-if="modelStatus?.trained">
                <span class="font-medium">Trained on {{ modelStatus.trainingExamples }} decided deals</span>
                <span class="text-xs text-muted-foreground">
                  Last trained {{ modelStatus.trainedAt ? new Date(modelStatus.trainedAt).toLocaleString() : '—' }}
                  <template v-if="modelStatus.accuracy !== null"> · {{ Math.round(modelStatus.accuracy * 100) }}% held-out accuracy</template>
                </span>
              </template>
              <template v-else>
                <span class="font-medium">Not enough data to train yet</span>
                <span class="text-xs text-muted-foreground">
                  {{ modelStatus?.trainingExamples ?? 0 }} of {{ modelStatus?.minTrainingExamples ?? 20 }} needed decided deals so far.
                </span>
              </template>
            </div>
            <Button size="sm" variant="outline" :disabled="isTraining" @click="onRetrainModel">
              <Icon name="i-lucide-refresh-cw" class="mr-1.5 size-3.5" :class="{ 'animate-spin': isTraining }" />
              {{ isTraining ? 'Training…' : 'Retrain Now' }}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between gap-2">
          <h3 class="text-sm font-medium text-muted-foreground">
            Quota Progress
          </h3>
          <Tabs v-model="quotaScope">
            <TabsList class="h-8">
              <TabsTrigger value="month" class="text-xs">
                This Month
              </TabsTrigger>
              <TabsTrigger value="year" class="text-xs">
                This Year
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <p class="text-xs text-muted-foreground -mt-1">
          Value won this calendar {{ quotaScope }} against each rep's {{ quotaScope === 'year' ? 'yearly' : 'monthly' }} target, independent of the date range above.
        </p>
        <div v-if="!quotaProgress.length" class="text-sm text-muted-foreground">
          No active BD/SM staff.
        </div>
        <div v-else class="grid grid-cols-1 gap-3 @xl/main:grid-cols-2 @3xl/main:grid-cols-3">
          <Card v-for="rep in quotaProgress" :key="rep.staffId">
            <CardHeader>
              <CardDescription>{{ rep.staffName }}</CardDescription>
              <CardTitle class="text-lg font-semibold tabular-nums">
                {{ rep.achievedValue.toLocaleString() }}
                <span v-if="rep.targetValue !== null" class="text-sm font-normal text-muted-foreground">
                  / {{ rep.targetValue.toLocaleString() }}
                </span>
                <span v-else class="text-sm font-normal text-muted-foreground">(no target set)</span>
              </CardTitle>
            </CardHeader>
            <CardContent v-if="rep.targetValue !== null">
              <div class="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div class="h-full rounded-full bg-primary" :style="{ width: `${Math.min(rep.percent ?? 0, 100)}%` }" />
              </div>
              <p class="mt-1 text-xs text-muted-foreground">
                {{ rep.percent }}% of target
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <h3 class="text-sm font-medium text-muted-foreground">
          Clients
        </h3>
        <div class="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2">
          <Card class="@container/card">
            <CardHeader>
              <CardDescription>New Clients</CardDescription>
              <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                <NumberFlow :value="summary?.clients.newCount ?? 0" />
              </CardTitle>
            </CardHeader>
          </Card>
          <Card class="@container/card">
            <CardHeader>
              <CardDescription>Stage Changes</CardDescription>
              <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                <NumberFlow :value="summary?.clients.stageChanges ?? 0" />
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>By Stage</CardTitle>
          </CardHeader>
          <CardContent>
            <p v-if="!clientsByStageData.length" class="text-sm text-muted-foreground">
              No clients in this range.
            </p>
            <DonutChart v-else :data="clientsByStageData" category="count" index="stage" />
          </CardContent>
        </Card>
      </div>

      <div class="flex flex-col gap-2">
        <h3 class="text-sm font-medium text-muted-foreground">
          AMC Contracts
        </h3>
        <div class="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2">
          <Card class="@container/card">
            <CardHeader>
              <CardDescription>New Contracts</CardDescription>
              <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                <NumberFlow :value="summary?.amc.newContracts ?? 0" />
              </CardTitle>
            </CardHeader>
          </Card>
          <Card v-for="row in summary?.amc.valueByCurrency ?? []" :key="row.currency" class="@container/card">
            <CardHeader>
              <CardDescription>Value ({{ row.currency }})</CardDescription>
              <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                <NumberFlow :value="row.total" />
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>By Status</CardTitle>
          </CardHeader>
          <CardContent>
            <p v-if="!amcByStatusData.length" class="text-sm text-muted-foreground">
              No contracts in this range.
            </p>
            <BarChart v-else :data="amcByStatusData" :categories="['count']" index="status" />
          </CardContent>
        </Card>
      </div>

      <div class="flex flex-col gap-2">
        <h3 class="text-sm font-medium text-muted-foreground">
          Tasks &amp; Projects
        </h3>
        <div class="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2">
          <Card class="@container/card">
            <CardHeader>
              <CardDescription>Tasks Completed</CardDescription>
              <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                <NumberFlow :value="summary?.tasks.completedCount ?? 0" />
              </CardTitle>
            </CardHeader>
          </Card>
          <Card class="@container/card">
            <CardHeader>
              <CardDescription>New Projects</CardDescription>
              <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                <NumberFlow :value="summary?.projects.newCount ?? 0" />
              </CardTitle>
            </CardHeader>
          </Card>
          <Card class="@container/card" :class="summary && summary.tasks.overdueCount > 0 ? 'border-amber-500/30' : ''">
            <CardHeader>
              <CardDescription>Tasks Overdue (now)</CardDescription>
              <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl" :class="summary && summary.tasks.overdueCount > 0 ? 'text-amber-600 dark:text-amber-400' : ''">
                <NumberFlow :value="summary?.tasks.overdueCount ?? 0" />
              </CardTitle>
            </CardHeader>
          </Card>
          <Card class="@container/card">
            <CardHeader>
              <CardDescription>All Projects by Status (now)</CardDescription>
            </CardHeader>
            <CardContent class="flex flex-wrap gap-1.5">
              <Badge v-for="row in summary?.projects.byStatus ?? []" :key="row.status" variant="outline">
                {{ titleCase(row.status) }}: {{ row.count }}
              </Badge>
              <span v-if="!summary?.projects.byStatus.length" class="text-sm text-muted-foreground">No projects yet.</span>
            </CardContent>
          </Card>
        </div>
      </div>

      <template v-if="summary">
        <!-- Tasks detail -->
        <div class="flex flex-col gap-2">
          <h3 class="text-sm font-medium text-muted-foreground">
            Tasks
          </h3>
          <div class="grid grid-cols-2 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs @3xl/main:grid-cols-4">
            <Card class="@container/card">
              <CardHeader>
                <CardDescription>Created in Range</CardDescription>
                <CardTitle class="text-2xl font-semibold tabular-nums">
                  <NumberFlow :value="summary.tasks.createdCount" />
                </CardTitle>
              </CardHeader>
            </Card>
            <Card class="@container/card">
              <CardHeader>
                <CardDescription>Completed in Range</CardDescription>
                <CardTitle class="text-2xl font-semibold tabular-nums">
                  <NumberFlow :value="summary.tasks.completedCount" />
                </CardTitle>
              </CardHeader>
            </Card>
            <Card class="@container/card">
              <CardHeader>
                <CardDescription>Open Now</CardDescription>
                <CardTitle class="text-2xl font-semibold tabular-nums">
                  <NumberFlow :value="summary.tasks.openByStatus.reduce((sum, row) => sum + row.count, 0)" />
                </CardTitle>
              </CardHeader>
            </Card>
            <Card class="@container/card" :class="summary.tasks.overdueCount > 0 ? 'border-amber-500/30' : ''">
              <CardHeader>
                <CardDescription>Overdue Now</CardDescription>
                <CardTitle class="text-2xl font-semibold tabular-nums" :class="summary.tasks.overdueCount > 0 ? 'text-amber-600 dark:text-amber-400' : ''">
                  <NumberFlow :value="summary.tasks.overdueCount" />
                </CardTitle>
              </CardHeader>
            </Card>
          </div>
          <div class="grid grid-cols-1 gap-4 @3xl/main:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Open Tasks by Status</CardTitle>
              </CardHeader>
              <CardContent class="flex flex-col gap-1.5 text-sm">
                <p v-if="!summary.tasks.openByStatus.length" class="text-muted-foreground">
                  No open tasks.
                </p>
                <div v-for="row in summary.tasks.openByStatus" :key="row.status" class="flex items-center justify-between">
                  <span>{{ row.label }}</span>
                  <span class="tabular-nums font-medium">{{ row.count }}</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Open Tasks by Priority</CardTitle>
              </CardHeader>
              <CardContent class="flex flex-col gap-1.5 text-sm">
                <p v-if="!summary.tasks.openByPriority.length" class="text-muted-foreground">
                  No open tasks.
                </p>
                <div v-for="row in summary.tasks.openByPriority" :key="row.priority" class="flex items-center justify-between">
                  <span>{{ titleCase(row.priority) }}</span>
                  <span class="tabular-nums font-medium">{{ row.count }}</span>
                </div>
              </CardContent>
            </Card>
          </div>
          <Card v-if="summary.tasks.overdue.length">
            <CardHeader>
              <CardTitle>Overdue Tasks</CardTitle>
            </CardHeader>
            <CardContent class="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Due</TableHead>
                    <TableHead>Task</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Assigned To</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="task in summary.tasks.overdue" :key="task.id">
                    <TableCell class="whitespace-nowrap text-amber-600 dark:text-amber-400">
                      {{ formatDay(task.dueDate) }}
                    </TableCell>
                    <TableCell class="font-medium">
                      {{ task.title }}
                    </TableCell>
                    <TableCell class="text-muted-foreground">
                      {{ task.projectName ?? '—' }}
                    </TableCell>
                    <TableCell>{{ task.status }}</TableCell>
                    <TableCell>{{ titleCase(task.priority) }}</TableCell>
                    <TableCell class="text-muted-foreground">
                      {{ task.assignees.join(', ') || 'Unassigned' }}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <!-- Projects list -->
        <div class="flex flex-col gap-2">
          <h3 class="text-sm font-medium text-muted-foreground">
            Projects
          </h3>
          <p class="text-xs text-muted-foreground -mt-1">
            Every planned, active and on-hold project, plus any created in this range.
          </p>
          <Card>
            <CardContent class="overflow-x-auto pt-6">
              <p v-if="!summary.projectList.length" class="text-sm text-muted-foreground">
                No projects.
              </p>
              <Table v-else>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead class="text-right">
                      Tasks Done
                    </TableHead>
                    <TableHead class="text-right">
                      Value
                    </TableHead>
                    <TableHead class="text-right">
                      Cost
                    </TableHead>
                    <TableHead class="text-right">
                      Margin
                    </TableHead>
                    <TableHead class="text-right">
                      Paid
                    </TableHead>
                    <TableHead class="text-right">
                      Due
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="project in summary.projectList" :key="project.id">
                    <TableCell class="font-medium">
                      {{ project.name }}
                      <Badge v-if="project.createdInRange" variant="outline" class="ml-1 text-[10px]">
                        New
                      </Badge>
                    </TableCell>
                    <TableCell class="text-muted-foreground">
                      {{ project.clientName ?? '—' }}
                    </TableCell>
                    <TableCell>{{ titleCase(project.status) }}</TableCell>
                    <TableCell class="whitespace-nowrap text-xs text-muted-foreground">
                      {{ project.startDate ? formatDay(project.startDate) : '—' }} → {{ project.endDate ? formatDay(project.endDate) : '—' }}
                    </TableCell>
                    <TableCell class="text-right tabular-nums">
                      {{ project.doneTaskCount }}/{{ project.taskCount }}
                    </TableCell>
                    <TableCell class="text-right tabular-nums">
                      {{ money(project.currency, project.contractValue) }}
                    </TableCell>
                    <TableCell class="text-right tabular-nums">
                      {{ money(project.currency, project.totalCost) }}
                    </TableCell>
                    <TableCell class="text-right tabular-nums" :class="project.margin !== undefined && project.margin < 0 ? 'text-destructive' : ''">
                      {{ money(project.currency, project.margin) }}
                    </TableCell>
                    <TableCell class="text-right tabular-nums">
                      {{ money(project.currency, project.amountPaid) }}
                    </TableCell>
                    <TableCell class="text-right tabular-nums" :class="project.amountDue !== undefined && project.amountDue > 0 ? 'text-amber-600 dark:text-amber-400 font-medium' : ''">
                      {{ money(project.currency, project.amountDue) }}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <!-- Deals won + new clients -->
        <div class="grid grid-cols-1 gap-4 @3xl/main:grid-cols-2">
          <div class="flex flex-col gap-2">
            <h3 class="text-sm font-medium text-muted-foreground">
              Deals Won in Range
            </h3>
            <Card>
              <CardContent class="flex flex-col gap-2 pt-6 text-sm">
                <p v-if="!summary.wonDeals.length" class="text-muted-foreground">
                  No deals won in this range.
                </p>
                <div v-for="deal in summary.wonDeals" :key="`${deal.kind}-${deal.id}`" class="flex items-center justify-between gap-2 border-b pb-2 last:border-0 last:pb-0">
                  <div class="flex flex-col">
                    <span class="font-medium">{{ deal.name }}</span>
                    <span class="text-xs text-muted-foreground">{{ titleCase(deal.kind) }} · {{ formatDay(deal.decidedAt) }}<template v-if="deal.reps.length"> · {{ deal.reps.join(', ') }}</template></span>
                  </div>
                  <span class="shrink-0 tabular-nums font-medium">{{ deal.value?.toLocaleString() ?? '—' }}</span>
                </div>
              </CardContent>
            </Card>
          </div>
          <div class="flex flex-col gap-2">
            <h3 class="text-sm font-medium text-muted-foreground">
              New Clients in Range
            </h3>
            <Card>
              <CardContent class="flex flex-col gap-2 pt-6 text-sm">
                <p v-if="!summary.newClients.length" class="text-muted-foreground">
                  No new clients in this range.
                </p>
                <div v-for="client in summary.newClients" :key="client.id" class="flex items-center justify-between gap-2 border-b pb-2 last:border-0 last:pb-0">
                  <span class="font-medium">{{ client.name }}</span>
                  <span class="shrink-0 text-xs text-muted-foreground">{{ titleCase(client.stage) }} · {{ formatDay(client.createdAt) }}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <!-- Calendar activity -->
        <div class="flex flex-col gap-2">
          <h3 class="text-sm font-medium text-muted-foreground">
            Calendar Activity
          </h3>
          <p class="text-xs text-muted-foreground -mt-1">
            Every meeting, site visit and other calendar activity in the range, with who took part and what it was linked to.
          </p>
          <div class="grid grid-cols-2 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs @3xl/main:grid-cols-4">
            <Card class="@container/card">
              <CardHeader>
                <CardDescription>Total Activities</CardDescription>
                <CardTitle class="text-2xl font-semibold tabular-nums">
                  <NumberFlow :value="summary.calendar.totalCount" />
                </CardTitle>
              </CardHeader>
            </Card>
            <Card class="@container/card">
              <CardHeader>
                <CardDescription>Completed</CardDescription>
                <CardTitle class="text-2xl font-semibold tabular-nums">
                  <NumberFlow :value="summary.calendar.completedCount" />
                </CardTitle>
              </CardHeader>
            </Card>
            <Card class="@container/card">
              <CardHeader>
                <CardDescription>Still Scheduled</CardDescription>
                <CardTitle class="text-2xl font-semibold tabular-nums">
                  <NumberFlow :value="summary.calendar.scheduledCount" />
                </CardTitle>
              </CardHeader>
            </Card>
            <Card class="@container/card">
              <CardHeader>
                <CardDescription>Linked to a Deal/Client</CardDescription>
                <CardTitle class="text-2xl font-semibold tabular-nums">
                  <NumberFlow :value="summary.calendar.linkedCount" />
                </CardTitle>
              </CardHeader>
            </Card>
          </div>
          <div class="grid grid-cols-1 gap-4 @3xl/main:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>By Activity Type</CardTitle>
              </CardHeader>
              <CardContent>
                <p v-if="!calendarByTypeData.length" class="text-sm text-muted-foreground">
                  No calendar activity in this range.
                </p>
                <BarChart v-else :data="calendarByTypeData" :categories="['count']" index="type" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Linked To</CardTitle>
              </CardHeader>
              <CardContent class="flex flex-col gap-2 text-sm">
                <p v-if="!summary.calendar.byRegarding.length" class="text-muted-foreground">
                  No calendar activity in this range.
                </p>
                <div v-for="row in summary.calendar.byRegarding" :key="row.regardingType" class="flex items-center justify-between">
                  <span>{{ REGARDING_LABEL[row.regardingType] ?? titleCase(row.regardingType) }}</span>
                  <span class="tabular-nums font-medium">{{ row.count }}</span>
                </div>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Activity Log</CardTitle>
              <CardDescription v-if="summary.calendar.truncated">
                Showing the first {{ summary.calendar.events.length }} of {{ summary.calendar.totalCount }}. Narrow the date range to see the rest.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p v-if="!summary.calendar.events.length" class="text-sm text-muted-foreground">
                No calendar activity in this range.
              </p>
              <div v-else class="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Activity</TableHead>
                      <TableHead>Regarding</TableHead>
                      <TableHead>Staff</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow v-for="event in summary.calendar.events" :key="event.id">
                      <TableCell class="whitespace-nowrap text-muted-foreground">
                        {{ formatDateTime(event.startAt) }}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {{ event.activityType }}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div class="font-medium">
                          {{ event.title }}
                        </div>
                        <div v-if="event.location" class="text-xs text-muted-foreground">
                          {{ event.location }}
                        </div>
                      </TableCell>
                      <TableCell class="text-muted-foreground">
                        <template v-if="event.regardingType">
                          {{ REGARDING_LABEL[event.regardingType] }}: {{ event.regardingLabel ?? '(deleted)' }}
                        </template>
                        <template v-else>
                          —
                        </template>
                      </TableCell>
                      <TableCell class="text-muted-foreground">
                        {{ event.staff.join(', ') || '—' }}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        <!-- Rep scorecard -->
        <div class="flex flex-col gap-2">
          <h3 class="text-sm font-medium text-muted-foreground">
            Rep Scorecard
          </h3>
          <p class="text-xs text-muted-foreground -mt-1">
            Per BD/SM staff member for the selected range. Deals count towards everyone assigned to them.
          </p>
          <Card>
            <CardContent class="overflow-x-auto pt-6">
              <p v-if="!summary.reps.length" class="text-sm text-muted-foreground">
                No active BD/SM staff.
              </p>
              <Table v-else>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rep</TableHead>
                    <TableHead class="text-right">
                      New Leads
                    </TableHead>
                    <TableHead class="text-right">
                      New Tenders
                    </TableHead>
                    <TableHead class="text-right">
                      Won
                    </TableHead>
                    <TableHead class="text-right">
                      Lost
                    </TableHead>
                    <TableHead class="text-right">
                      Won Value
                    </TableHead>
                    <TableHead class="text-right">
                      Activities
                    </TableHead>
                    <TableHead class="text-right">
                      Interactions
                    </TableHead>
                    <TableHead class="text-right">
                      Tasks Done
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="rep in summary.reps" :key="rep.staffId">
                    <TableCell class="font-medium">
                      {{ rep.staffName }}
                    </TableCell>
                    <TableCell class="text-right tabular-nums">
                      {{ rep.newLeads }}
                    </TableCell>
                    <TableCell class="text-right tabular-nums">
                      {{ rep.newTenders }}
                    </TableCell>
                    <TableCell class="text-right tabular-nums">
                      {{ rep.dealsWon }}
                    </TableCell>
                    <TableCell class="text-right tabular-nums">
                      {{ rep.dealsLost }}
                    </TableCell>
                    <TableCell class="text-right tabular-nums font-medium">
                      {{ rep.wonValue.toLocaleString() }}
                    </TableCell>
                    <TableCell class="text-right tabular-nums">
                      {{ rep.calendarActivities }}
                    </TableCell>
                    <TableCell class="text-right tabular-nums">
                      {{ rep.interactionsLogged }}
                    </TableCell>
                    <TableCell class="text-right tabular-nums">
                      {{ rep.tasksCompleted }}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <!-- Interactions + Quotes -->
        <div class="grid grid-cols-1 gap-4 @3xl/main:grid-cols-2">
          <div class="flex flex-col gap-2">
            <h3 class="text-sm font-medium text-muted-foreground">
              Logged Interactions
            </h3>
            <Card>
              <CardHeader>
                <CardDescription>Calls, emails, meetings and notes logged on leads, tenders and clients</CardDescription>
                <CardTitle class="text-2xl font-semibold tabular-nums">
                  <NumberFlow :value="summary.interactions.totalCount" />
                </CardTitle>
              </CardHeader>
              <CardContent class="flex flex-wrap gap-1.5">
                <Badge v-for="row in summary.interactions.byType" :key="row.type" variant="outline">
                  {{ titleCase(row.type) }}: {{ row.count }}
                </Badge>
              </CardContent>
            </Card>
          </div>
          <div class="flex flex-col gap-2">
            <h3 class="text-sm font-medium text-muted-foreground">
              Quotes &amp; Orders
            </h3>
            <Card>
              <CardHeader>
                <CardDescription>Quotes created in this range</CardDescription>
                <CardTitle class="text-2xl font-semibold tabular-nums">
                  <NumberFlow :value="summary.quotes.createdCount" />
                </CardTitle>
              </CardHeader>
              <CardContent class="flex flex-col gap-1.5 text-sm">
                <div v-for="row in summary.quotes.byStatus" :key="row.status" class="flex items-center justify-between">
                  <span>{{ titleCase(row.status) }} ({{ row.count }})</span>
                  <span class="tabular-nums font-medium">{{ row.value.toLocaleString() }}</span>
                </div>
                <div v-for="row in summary.quotes.ordersByCurrency" :key="row.currency" class="flex items-center justify-between border-t pt-1.5">
                  <span>Confirmed orders ({{ row.count }})</span>
                  <span class="tabular-nums font-medium">{{ row.currency }} {{ row.total.toLocaleString() }}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <!-- Project money -->
        <div class="flex flex-col gap-2">
          <h3 class="text-sm font-medium text-muted-foreground">
            Project Payments
          </h3>
          <p class="text-xs text-muted-foreground -mt-1">
            Payments and costs dated in this range. "Still due" is what clients owe across all projects today.
          </p>
          <p v-if="!summary.projectFinancials.length" class="text-sm text-muted-foreground">
            No project payments or costs recorded yet. Set a project value and record payments from a project's Financials section.
          </p>
          <div v-for="row in summary.projectFinancials" :key="row.currency" class="grid grid-cols-2 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs @3xl/main:grid-cols-4">
            <Card class="@container/card">
              <CardHeader>
                <CardDescription>Payments Received ({{ row.currency }})</CardDescription>
                <CardTitle class="text-2xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {{ row.paymentsReceived.toLocaleString() }}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card class="@container/card">
              <CardHeader>
                <CardDescription>Costs Incurred ({{ row.currency }})</CardDescription>
                <CardTitle class="text-2xl font-semibold tabular-nums">
                  {{ row.costsIncurred.toLocaleString() }}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card class="@container/card" :class="row.outstandingDue > 0 ? 'border-amber-500/30' : ''">
              <CardHeader>
                <CardDescription>Still Due ({{ row.currency }})</CardDescription>
                <CardTitle class="text-2xl font-semibold tabular-nums" :class="row.outstandingDue > 0 ? 'text-amber-600 dark:text-amber-400' : ''">
                  {{ row.outstandingDue.toLocaleString() }}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card class="@container/card">
              <CardHeader>
                <CardDescription>Projects With a Balance</CardDescription>
                <CardTitle class="text-2xl font-semibold tabular-nums">
                  {{ row.projectsWithBalance }}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>
        </div>

        <!-- Coming up -->
        <div class="flex flex-col gap-2">
          <h3 class="text-sm font-medium text-muted-foreground">
            Coming Up (Next 14 Days)
          </h3>
          <div class="grid grid-cols-1 gap-4 @3xl/main:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Scheduled Activities</CardTitle>
              </CardHeader>
              <CardContent class="flex flex-col gap-2 text-sm">
                <p v-if="!summary.upcoming.events.length" class="text-muted-foreground">
                  Nothing scheduled.
                </p>
                <div v-for="event in summary.upcoming.events" :key="event.id" class="flex flex-col gap-0.5 border-b pb-2 last:border-0 last:pb-0">
                  <div class="flex items-center justify-between gap-2">
                    <span class="font-medium">{{ event.title }}</span>
                    <Badge variant="outline" class="shrink-0">
                      {{ event.activityType }}
                    </Badge>
                  </div>
                  <span class="text-xs text-muted-foreground">
                    {{ formatDateTime(event.startAt) }}<template v-if="event.regardingType"> · {{ REGARDING_LABEL[event.regardingType] }}: {{ event.regardingLabel ?? '(deleted)' }}</template><template v-if="event.staff.length"> · {{ event.staff.join(', ') }}</template>
                  </span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Tender Deadlines</CardTitle>
                <CardDescription>Open tenders not yet submitted</CardDescription>
              </CardHeader>
              <CardContent class="flex flex-col gap-2 text-sm">
                <p v-if="!summary.upcoming.tenderDeadlines.length" class="text-muted-foreground">
                  No submission deadlines in the next 14 days.
                </p>
                <div v-for="tender in summary.upcoming.tenderDeadlines" :key="tender.id" class="flex items-center justify-between gap-2 border-b pb-2 last:border-0 last:pb-0">
                  <div class="flex flex-col">
                    <span class="font-medium">{{ tender.title }}</span>
                    <span class="text-xs text-muted-foreground">{{ titleCase(tender.stage) }}<template v-if="tender.estimatedValue !== undefined"> · {{ tender.estimatedValue.toLocaleString() }}</template></span>
                  </div>
                  <div class="flex flex-col items-end shrink-0 text-xs">
                    <span>{{ formatDay(tender.submissionDeadline) }}</span>
                    <span class="text-amber-600 dark:text-amber-400">{{ daysUntil(tender.submissionDeadline) }}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </template>

      <p v-if="isLoading" class="text-sm text-muted-foreground">
        Loading…
      </p>
    </main>
  </div>
</template>
