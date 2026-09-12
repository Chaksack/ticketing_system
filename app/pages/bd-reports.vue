<script setup lang="ts">
import { toast } from 'vue-sonner'
import { downloadBdReportPdf } from '~/lib/bdReportPdf'

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

function currentPeriod() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

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
    await downloadBdReportPdf(summary.value)
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
</script>

<template>
  <div class="w-full flex flex-col gap-4">
    <div class="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">
          BD &amp; SM Reports
        </h2>
        <p class="text-muted-foreground">
          Leads, clients, AMC contracts, and tasks over a date range.
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
        <h3 class="text-sm font-medium text-muted-foreground">
          Quota Progress
        </h3>
        <p class="text-xs text-muted-foreground -mt-1">
          Weighted value won this calendar month against each rep's target — independent of the date range above.
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
        </div>
      </div>

      <p v-if="isLoading" class="text-sm text-muted-foreground">
        Loading…
      </p>
    </main>
  </div>
</template>
