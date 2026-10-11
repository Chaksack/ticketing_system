<script setup lang="ts">
import type { Lead } from '~/types/lead'
import type { SalesDashboard } from '~/types/salesDashboard'
import { leadStages } from '~/components/leads/data'

// The Sales dashboard ("Web app — Sales dashboard" in the Canopy design).
definePageMeta({
  middleware: 'bd',
})

const { currentUser } = useAuth()
const { refreshAll, isRefreshing } = useAppRefresh()
const { ask } = useAssistant()
const { leads, fetchLeads } = useLeads()
const { upcomingRenewals, fetchUpcomingRenewals } = useClients()

type Period = 'month' | 'quarter' | 'year'
const period = ref<Period>('quarter')
const now = new Date()
const PERIOD_TABS = computed(() => [
  { value: 'month' as const, label: now.toLocaleDateString(undefined, { month: 'long' }) },
  { value: 'quarter' as const, label: `Q${Math.floor(now.getMonth() / 3) + 1} ${now.getFullYear()}` },
  { value: 'year' as const, label: `${now.getFullYear()}` },
])

const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

/** Local-calendar bounds for the period, plus the quota periods that cover it. */
function periodRange(value: Period) {
  const year = now.getFullYear()
  const startMonth = value === 'month' ? now.getMonth() : value === 'quarter' ? Math.floor(now.getMonth() / 3) * 3 : 0
  const months = value === 'month' ? 1 : value === 'quarter' ? 3 : 12
  const from = new Date(year, startMonth, 1)
  const to = new Date(year, startMonth + months, 1, 0, 0, 0, -1)
  const quotaPeriods = value === 'year'
    ? [`${year}`]
    : Array.from({ length: months }, (_, i) => monthKey(new Date(year, startMonth + i, 1)))
  return { from, to, quotaPeriods }
}

// Last six calendar months, oldest first, for the "Revenue won by month" bars.
const TREND_MONTHS = Array.from({ length: 6 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - 5 + i, 1))

const dashboard = ref<SalesDashboard | null>(null)
const loadError = ref('')

async function loadDashboard() {
  const { from, to, quotaPeriods } = periodRange(period.value)
  const todayFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayTo = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, -1)
  try {
    dashboard.value = await $fetch<SalesDashboard>('/api/bd-reports/pipeline', {
      query: {
        from: from.toISOString(),
        to: to.toISOString(),
        trendFrom: TREND_MONTHS[0]!.toISOString(),
        todayFrom: todayFrom.toISOString(),
        todayTo: todayTo.toISOString(),
        quotaPeriods: quotaPeriods.join(','),
      },
    })
    loadError.value = ''
  }
  catch (error: any) {
    loadError.value = error?.data?.statusMessage ?? 'Could not load the dashboard.'
  }
}

onMounted(async () => {
  // Sequential, not concurrent — db0's postgresql connector shares a single client and warns
  // (and can wedge) on overlapping concurrent queries.
  await loadDashboard()
  await fetchLeads()
  await fetchUpcomingRenewals()
})

watch(period, loadDashboard)

const greeting = computed(() => {
  const hour = now.getHours()
  const part = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = currentUser.value?.name.split(' ')[0]
  return firstName ? `${part}, ${firstName}` : part
})

const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 2 })
const whole = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 })

const periodLabel = computed(() => ({ month: 'this month', quarter: 'this quarter', year: 'this year' })[period.value])

const quotaLine = computed(() => {
  const d = dashboard.value
  if (!d)
    return ''
  if (d.quotaTarget)
    return `${Math.round((d.wonValue / d.quotaTarget) * 100)}% of team quota`
  return `${d.wonCount} deal${d.wonCount === 1 ? '' : 's'} won`
})

const activitiesLine = computed(() => {
  const d = dashboard.value
  if (!d?.activitiesToday)
    return 'Nothing on your calendar'
  return d.activitiesByType.map(a => `${a.count} ${a.type.toLowerCase()}${a.count === 1 ? '' : 's'}`).join(' · ')
})

const STAGE_LABEL: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  proposal: 'Proposal',
  tenders: 'Tenders',
}
const STAGE_BAR: Record<string, string> = {
  new: 'bg-brand-mist ring-1 ring-inset ring-brand-forest',
  contacted: 'bg-brand-lime',
  qualified: 'bg-brand-lime',
  proposal: 'bg-brand-spruce',
  tenders: 'bg-brand-forest dark:bg-brand-lime',
}
const stageRows = computed(() => {
  const rows = dashboard.value?.byStage ?? []
  const max = Math.max(1, ...rows.map(r => r.value))
  return rows.map(row => ({ ...row, label: STAGE_LABEL[row.key] ?? row.key, width: row.value ? Math.max(4, (row.value / max) * 100) : 0 }))
})

const trendBars = computed(() => {
  const byMonth = new Map((dashboard.value?.wonByMonth ?? []).map(m => [m.month, m.value]))
  const values = TREND_MONTHS.map(date => byMonth.get(monthKey(date)) ?? 0)
  const max = Math.max(1, ...values)
  return TREND_MONTHS.map((date, i) => ({
    key: monthKey(date),
    label: date.toLocaleDateString(undefined, { month: 'short' }),
    value: values[i]!,
    height: values[i] ? Math.max(4, (values[i]! / max) * 100) : 0,
    current: i === TREND_MONTHS.length - 1,
  }))
})

const OPEN_STAGES = new Set(['new', 'contacted', 'qualified', 'proposal'])
const myOpenLeads = computed(() => leads.value
  .filter(lead => OPEN_STAGES.has(lead.stage) && lead.assignees.some(a => a.id === currentUser.value?.id))
  .sort((a, b) => (b.estimatedValue ?? 0) - (a.estimatedValue ?? 0)))

function stageLabel(lead: Lead) {
  return leadStages.find(s => s.value === lead.stage)?.label ?? lead.stage
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
}

const DAY_MS = 24 * 60 * 60 * 1000
const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS)
const daysUntil = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / DAY_MS)

/** Up to three nudges worked out from the viewer's own leads and the renewals list. */
const suggestions = computed(() => {
  const items: { id: string, text: string, action: { label: string, to: string } }[] = []

  const overdue = myOpenLeads.value
    .filter(lead => lead.nextStepAt && new Date(lead.nextStepAt).getTime() < Date.now())
    .sort((a, b) => a.nextStepAt!.localeCompare(b.nextStepAt!))[0]
  if (overdue)
    items.push({ id: `overdue-${overdue.id}`, text: `${overdue.name}: "${overdue.nextStep ?? 'next step'}" was due ${formatDate(overdue.nextStepAt)}.`, action: { label: 'Open lead', to: `/leads?open=${overdue.id}` } })

  const stale = myOpenLeads.value
    .filter(lead => lead.id !== overdue?.id && daysSince(lead.updatedAt) >= 7)
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))[0]
  if (stale)
    items.push({ id: `stale-${stale.id}`, text: `${stale.name} hasn't been updated in ${daysSince(stale.updatedAt)} days.`, action: { label: 'Open lead', to: `/leads?open=${stale.id}` } })

  const renewal = upcomingRenewals.value.find(r => daysUntil(r.endDate) <= 30)
  if (renewal)
    items.push({ id: `renewal-${renewal.contractId}`, text: `${renewal.clientName}'s ${renewal.planName} contract ends ${formatDate(renewal.endDate)}.`, action: { label: 'Open client', to: `/clients?open=${renewal.clientId}` } })

  return items
})

const question = ref('')
function askAssistant() {
  if (!question.value.trim())
    return
  ask(question.value)
  question.value = ''
}
</script>

<template>
  <div class="flex w-full flex-col gap-4">
    <PageActions label="Dashboard actions">
      <Button variant="lime" as-child>
        <NuxtLink to="/leads">
          <Icon name="i-lucide-plus" />
          New lead
        </NuxtLink>
      </Button>
      <Button variant="ghost" :disabled="isRefreshing" @click="refreshAll">
        <Icon name="i-lucide-refresh-cw" :class="isRefreshing ? 'animate-spin' : ''" />
        Refresh all
      </Button>
      <Button variant="ghost" as-child>
        <NuxtLink to="/bd-reports">
          <Icon name="i-lucide-file-bar-chart" />
          BD &amp; SM report
        </NuxtLink>
      </Button>
    </PageActions>

    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <div class="text-[15px] text-muted-foreground">
          {{ greeting }}
        </div>
        <h1 class="mt-1 text-4xl font-black leading-none tracking-[-0.045em] text-foreground sm:text-[44px]">
          Sales pipeline
        </h1>
      </div>
      <PageSegmentedTabs v-model="period" label="Period" :options="PERIOD_TABS" />
    </div>

    <p v-if="loadError" role="alert" class="rounded-2xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
      {{ loadError }}
    </p>

    <!-- KPIs -->
    <div class="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
      <div class="rounded-[28px] bg-brand-forest p-5.5">
        <div class="text-sm text-brand-mist">
          Weighted pipeline
        </div>
        <div class="mt-1.5 text-[38px] font-black leading-tight tracking-[-0.04em] text-brand-lime">
          {{ dashboard ? compact.format(dashboard.weightedPipeline) : '—' }}
        </div>
        <div class="mt-1 text-[13px] text-white">
          {{ dashboard ? `${dashboard.openDeals} open leads and tenders` : 'Loading…' }}
        </div>
      </div>
      <div class="rounded-[28px] bg-card p-5.5 ring-1 ring-black/10 dark:ring-white/10">
        <div class="text-sm text-muted-foreground">
          Won {{ periodLabel }}
        </div>
        <div class="mt-1.5 text-[38px] font-black leading-tight tracking-[-0.04em] text-foreground">
          {{ dashboard ? compact.format(dashboard.wonValue) : '—' }}
        </div>
        <div class="mt-1 text-[13px] font-semibold text-brand-spruce dark:text-brand-lime">
          {{ quotaLine }}
        </div>
      </div>
      <div class="rounded-[28px] bg-card p-5.5 ring-1 ring-black/10 dark:ring-white/10">
        <div class="text-sm text-muted-foreground">
          Win rate
        </div>
        <div class="mt-1.5 text-[38px] font-black leading-tight tracking-[-0.04em] text-foreground">
          {{ dashboard?.winRate !== null && dashboard?.winRate !== undefined ? `${dashboard.winRate}%` : '—' }}
        </div>
        <div class="mt-1 text-[13px] text-muted-foreground">
          Last 90 days<template v-if="dashboard">
            · {{ dashboard.decidedLast90Days }} decided
          </template>
        </div>
      </div>
      <div class="rounded-[28px] bg-brand-mist p-5.5 dark:bg-brand-spruce">
        <div class="text-sm text-brand-spruce dark:text-brand-mist">
          Activities today
        </div>
        <div class="mt-1.5 text-[38px] font-black leading-tight tracking-[-0.04em] text-brand-forest dark:text-brand-lime">
          {{ dashboard?.activitiesToday ?? '—' }}
        </div>
        <NuxtLink to="/calendar" class="mt-1 block text-[13px] text-brand-forest underline-offset-2 hover:underline dark:text-white">
          {{ activitiesLine }}
        </NuxtLink>
      </div>
    </div>

    <!-- Charts -->
    <div class="grid gap-3.5 lg:grid-cols-2">
      <section class="flex flex-col gap-4 rounded-[28px] bg-card p-6 ring-1 ring-black/10 dark:ring-white/10">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="m-0 text-lg font-bold text-foreground">
            Pipeline by stage
          </h2>
          <span class="text-[13px] text-muted-foreground">Estimated value, open deals</span>
        </div>
        <ul class="m-0 flex list-none flex-col gap-3 p-0">
          <li v-for="row in stageRows" :key="row.key" class="grid grid-cols-[88px_1fr_72px] items-center gap-3 text-sm">
            <span class="font-medium">{{ row.label }}</span>
            <div class="h-7 rounded-full bg-brand-fog dark:bg-muted" role="img" :aria-label="`${row.label}: ${whole.format(row.value)} across ${row.count} deals`">
              <div class="h-full rounded-full" :class="STAGE_BAR[row.key]" :style="{ width: `${row.width}%` }" />
            </div>
            <span class="text-right font-semibold tabular-nums text-foreground">{{ compact.format(row.value) }}</span>
          </li>
        </ul>
      </section>

      <section class="flex flex-col gap-4 rounded-[28px] bg-card p-6 ring-1 ring-black/10 dark:ring-white/10">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="m-0 text-lg font-bold text-foreground">
            Revenue won by month
          </h2>
          <span class="text-[13px] text-muted-foreground">Leads and tenders won</span>
        </div>
        <div class="grid h-[170px] grid-cols-6 items-end gap-3.5 border-b border-brand-fog pb-1 dark:border-border">
          <div v-for="bar in trendBars" :key="bar.key" class="flex h-full flex-col justify-end" :title="`${bar.label}: ${whole.format(bar.value)}`">
            <div
              class="rounded-t-[10px] rounded-b-[2px]"
              :class="bar.current ? 'bg-brand-forest dark:bg-brand-lime' : bar.value ? 'bg-brand-lime' : ''"
              :style="{ height: `${bar.height}%` }"
            />
          </div>
        </div>
        <div class="grid grid-cols-6 gap-3.5 text-center text-xs text-muted-foreground">
          <span v-for="bar in trendBars" :key="bar.key" :class="bar.current ? 'font-semibold text-primary dark:text-brand-lime' : ''">
            {{ bar.label }}<span class="sr-only">: {{ whole.format(bar.value) }}</span>
          </span>
        </div>
      </section>
    </div>

    <!-- Opportunities + Assist -->
    <div class="flex flex-wrap items-start gap-3.5">
      <section class="flex min-w-0 flex-[2_1_560px] flex-col gap-3 rounded-[28px] bg-card p-6 ring-1 ring-black/10 dark:ring-white/10">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="m-0 text-lg font-bold text-foreground">
            My open leads
          </h2>
          <NuxtLink to="/leads" class="text-sm font-medium text-primary hover:underline dark:text-brand-lime">
            View all
          </NuxtLink>
        </div>
        <Table class="[&_th]:h-11 [&_th]:text-[13px] [&_th]:font-semibold">
          <TableHeader>
            <TableRow>
              <TableHead>Lead</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead class="text-right">
                Est. value
              </TableHead>
              <TableHead>Next step</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <template v-if="myOpenLeads.length">
              <TableRow v-for="lead in myOpenLeads.slice(0, 6)" :key="lead.id">
                <TableCell>
                  <NuxtLink :to="`/leads?open=${lead.id}`" class="font-semibold text-primary hover:underline dark:text-brand-lime">
                    {{ lead.name }}
                  </NuxtLink>
                </TableCell>
                <TableCell class="text-muted-foreground">
                  {{ lead.contactName ?? '—' }}
                </TableCell>
                <TableCell>
                  <span class="rounded-full bg-brand-mist px-2.5 py-1 text-xs font-semibold text-brand-forest">{{ stageLabel(lead) }}</span>
                </TableCell>
                <TableCell class="text-right font-semibold tabular-nums text-foreground">
                  {{ lead.estimatedValue !== undefined ? whole.format(lead.estimatedValue) : '—' }}
                </TableCell>
                <TableCell class="text-muted-foreground">
                  {{ formatDate(lead.nextStepAt) }}
                </TableCell>
              </TableRow>
            </template>
            <TableRow v-else>
              <TableCell :colspan="5" class="h-20 text-center text-muted-foreground">
                No open leads are assigned to you.
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </section>

      <section class="dark flex flex-[1_1_300px] flex-col gap-3.5 rounded-[28px] bg-brand-forest p-6 text-white" aria-labelledby="assist-heading">
        <div class="flex items-center gap-2">
          <span id="assist-heading" class="rounded-full bg-brand-lime px-3 py-1.5 text-xs font-bold text-brand-forest">Canopy Assist</span>
          <span class="text-[13px] text-brand-mist">Suggestions for today</span>
        </div>
        <div v-for="item in suggestions" :key="item.id" class="rounded-xl bg-brand-spruce p-3.5 text-sm leading-normal">
          {{ item.text }}
          <div class="mt-2.5">
            <NuxtLink :to="item.action.to" class="inline-flex min-h-8 items-center rounded-full bg-brand-lime px-3.5 text-[13px] font-semibold text-brand-forest hover:bg-brand-lime/85">
              {{ item.action.label }}
            </NuxtLink>
          </div>
        </div>
        <p v-if="!suggestions.length" class="m-0 rounded-xl bg-brand-spruce p-3.5 text-sm leading-normal">
          You're up to date: no overdue next steps, stale leads or renewals in the next 30 days.
        </p>
        <form class="flex flex-col gap-1.5" @submit.prevent="askAssistant">
          <label for="assist-question" class="text-[13px] text-brand-mist">Ask about your pipeline</label>
          <div class="flex gap-2">
            <input
              id="assist-question"
              v-model="question"
              type="text"
              placeholder="Which deals are at risk this month?"
              class="min-h-11 min-w-0 flex-1 rounded-xl border border-brand-lime bg-brand-forest px-3.5 text-sm text-white outline-none placeholder:text-brand-mist/70 focus-visible:ring-2 focus-visible:ring-brand-lime"
            >
            <Button type="submit" variant="lime" size="icon-lg" aria-label="Ask" :disabled="!question.trim()">
              <Icon name="i-lucide-arrow-up" />
            </Button>
          </div>
        </form>
      </section>
    </div>

    <section class="flex flex-col gap-3 rounded-[28px] bg-card p-6 ring-1 ring-black/10 dark:ring-white/10">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="m-0 text-lg font-bold text-foreground">
          Upcoming renewals
        </h2>
        <span class="text-[13px] text-muted-foreground">Soonest-ending active AMC contracts</span>
      </div>
      <Table class="[&_th]:h-11 [&_th]:text-[13px] [&_th]:font-semibold">
        <TableHeader>
          <TableRow>
            <TableHead>Client</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Ends</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="upcomingRenewals.length">
            <TableRow v-for="renewal in upcomingRenewals" :key="renewal.contractId">
              <TableCell>
                <NuxtLink :to="`/clients?open=${renewal.clientId}`" class="font-semibold text-primary hover:underline dark:text-brand-lime">
                  {{ renewal.clientName }}
                </NuxtLink>
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ renewal.planName }}
              </TableCell>
              <TableCell :class="daysUntil(renewal.endDate) <= 7 ? 'font-semibold text-destructive' : ''">
                {{ formatDate(renewal.endDate) }}
              </TableCell>
            </TableRow>
          </template>
          <TableRow v-else>
            <TableCell :colspan="3" class="h-20 text-center text-muted-foreground">
              No active AMC contracts.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </section>
  </div>
</template>
