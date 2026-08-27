<script setup lang="ts">
import { toast } from 'vue-sonner'
import { downloadBdReportPdf } from '~/lib/bdReportPdf'

definePageMeta({
  middleware: 'bd',
})

const { summary, isLoading, fetchSummary } = useBdReports()

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10)
}

const from = ref('')
const to = ref('')

async function refresh() {
  await fetchSummary({ from: from.value, to: to.value })
}

onMounted(() => {
  const today = new Date()
  from.value = toDateInput(new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000))
  to.value = toDateInput(today)
  refresh()
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
        <div class="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs @xl/main:grid-cols-3">
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
