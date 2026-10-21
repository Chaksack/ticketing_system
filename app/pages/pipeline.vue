<script setup lang="ts">
import type { Lead, LeadStage } from '~/types/lead'
import type { Tender, TenderStage } from '~/types/tender'
import { toast } from 'vue-sonner'
import { leadStages } from '~/components/leads/data'
import { tenderStages } from '~/components/tenders/data'

// Sales pipeline board: every open lead or tender as a card in its stage; drag a card (or use its
// "Move" menu) to change the stage. Headline figures and value-by-stage follow the filters.
definePageMeta({ middleware: 'bd' })

const { currentUser } = useAuth()
const { leads, fetchLeads, updateLead } = useLeads()
const { tenders, fetchTenders, updateTender } = useTenders()
const { staff, fetchStaff } = useStaff()

type Kind = 'lead' | 'tender'
const kind = ref<Kind>('lead')
const loading = ref(true)
onMounted(async () => {
  try {
    await fetchLeads()
    await fetchTenders()
  }
  finally {
    loading.value = false
  }
  if (!staff.value.length)
    await fetchStaff()
})

interface Deal {
  id: string
  kind: Kind
  title: string
  subtitle?: string
  value: number
  stage: string
  ownerIds: string[]
  ownerNames: string[]
  date?: { label: string, iso: string }
  stageChangedAt: string
  createdAt: string
  converted: boolean
}

const LEAD_LABELS: Record<LeadStage, string> = { new: 'New', contacted: 'Contacted', qualified: 'Qualified', proposal: 'Proposal', won: 'Won', lost: 'Lost' }
const STAGES = computed(() => kind.value === 'lead'
  ? leadStages.map(s => ({ value: s.value as string, label: LEAD_LABELS[s.value as LeadStage], probability: s.probability }))
  : tenderStages.map(s => ({ value: s.value as string, label: s.label, probability: s.probability })))
const CLOSED = new Set(['won', 'lost'])

// Moves show immediately; the server confirms in the background (saves can take a few seconds).
const pendingStage = reactive<Record<string, string>>({})

const toDeal = {
  lead: (l: Lead): Deal => ({ id: l.id, kind: 'lead', title: l.name, subtitle: l.contactName, value: l.estimatedValue ?? 0, stage: pendingStage[l.id] ?? l.stage, ownerIds: l.assignees.map(a => a.id), ownerNames: l.assignees.map(a => a.name), date: l.nextStepAt ? { label: 'Next step', iso: l.nextStepAt } : undefined, stageChangedAt: l.stageChangedAt ?? l.createdAt, createdAt: l.createdAt, converted: !!l.convertedClientId }),
  tender: (t: Tender): Deal => ({ id: t.id, kind: 'tender', title: t.title, subtitle: t.issuingAuthority, value: t.estimatedValue ?? 0, stage: pendingStage[t.id] ?? t.stage, ownerIds: t.assignees.map(a => a.id), ownerNames: t.assignees.map(a => a.name), date: t.submissionDeadline ? { label: 'Deadline', iso: t.submissionDeadline } : undefined, stageChangedAt: t.stageChangedAt ?? t.createdAt, createdAt: t.createdAt, converted: !!t.convertedClientId }),
}

// ── Filters ───────────────────────────────────────────────────────────────
const owner = ref('all')
const search = ref('')
const ownerOptions = computed(() => [
  { value: 'all', label: 'Everyone' },
  { value: 'me', label: 'My deals' },
  { value: 'unassigned', label: 'Unassigned' },
  ...staff.value.filter(s => s.status === 'active' && s.roles.some(r => r === 'bd' || r === 'sm' || r === 'admin')).map(s => ({ value: s.id, label: s.name })),
])

const deals = computed(() => {
  const all = kind.value === 'lead' ? leads.value.map(toDeal.lead) : tenders.value.map(toDeal.tender)
  const q = search.value.trim().toLowerCase()
  return all.filter((deal) => {
    if (owner.value === 'me' && !deal.ownerIds.includes(currentUser.value?.id ?? ''))
      return false
    if (owner.value === 'unassigned' && deal.ownerIds.length)
      return false
    if (!['all', 'me', 'unassigned'].includes(owner.value) && !deal.ownerIds.includes(owner.value))
      return false
    return !q || deal.title.toLowerCase().includes(q) || (deal.subtitle ?? '').toLowerCase().includes(q) || deal.id.toLowerCase().includes(q)
  })
})

const columns = computed(() => STAGES.value.map((stage) => {
  const cards = deals.value.filter(d => d.stage === stage.value).sort((a, b) => b.value - a.value)
  const total = cards.reduce((sum, d) => sum + d.value, 0)
  return { ...stage, cards, total, weighted: Math.round(total * stage.probability / 100), closed: CLOSED.has(stage.value) }
}))

// ── Headline figures ──────────────────────────────────────────────────────
const DAY = 86400000
const openDeals = computed(() => deals.value.filter(d => !CLOSED.has(d.stage)))
const kpis = computed(() => {
  const open = openDeals.value
  const value = open.reduce((s, d) => s + d.value, 0)
  const weighted = columns.value.filter(c => !c.closed).reduce((s, c) => s + c.weighted, 0)
  const won = deals.value.filter(d => d.stage === 'won').length
  const lost = deals.value.filter(d => d.stage === 'lost').length
  const ages = open.map(d => (Date.now() - new Date(d.createdAt).getTime()) / DAY)
  return {
    open: open.length,
    value,
    weighted,
    winRate: won + lost ? Math.round((won / (won + lost)) * 100) : null,
    decided: won + lost,
    avgAge: ages.length ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : null,
  }
})
const openColumns = computed(() => columns.value.filter(c => !c.closed))
const maxStageValue = computed(() => Math.max(1, ...openColumns.value.map(c => c.total)))

// ── Moving deals ──────────────────────────────────────────────────────────
const dragging = ref<Deal | null>(null)
const dropTarget = ref<string | null>(null)

async function move(deal: Deal, stage: string) {
  if (deal.stage === stage)
    return
  if (deal.converted) {
    toast.error('Already converted to a client', { description: 'Open the record to change it.' })
    return
  }
  const label = STAGES.value.find(s => s.value === stage)?.label
  pendingStage[deal.id] = stage
  try {
    if (deal.kind === 'lead')
      await updateLead(deal.id, { stage: stage as LeadStage })
    else
      await updateTender(deal.id, { stage: stage as TenderStage })
    toast(`${deal.title} → ${label}`, stage === 'won' ? { description: `Open the record to convert it to a client.`, action: { label: 'Open', onClick: () => navigateTo(`/${deal.kind}s/${deal.id}`) } } : undefined)
  }
  catch (error: any) {
    toast.error('Could not move the deal', { description: error?.data?.statusMessage ?? 'It has been put back.' })
  }
  finally {
    delete pendingStage[deal.id]
  }
}

function onDragStart(event: DragEvent, deal: Deal) {
  dragging.value = deal
  event.dataTransfer?.setData('text/plain', deal.id)
  if (event.dataTransfer)
    event.dataTransfer.effectAllowed = 'move'
}
function onDrop(stage: string) {
  const deal = dragging.value
  dragging.value = null
  dropTarget.value = null
  if (deal)
    move(deal, stage)
}

const showClosed = ref<Record<string, boolean>>({})

// ── Formatting ────────────────────────────────────────────────────────────
const compact = new Intl.NumberFormat(APP_LOCALE, { notation: 'compact', maximumFractionDigits: 1 })
const whole = new Intl.NumberFormat(APP_LOCALE, { maximumFractionDigits: 0 })
const daysSince = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / DAY))
const initials = (name: string) => name.split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase()
function dateBadge(deal: Deal) {
  if (!deal.date)
    return null
  const days = Math.ceil((new Date(deal.date.iso).getTime() - Date.now()) / DAY)
  const text = days < 0 ? `${-days}d overdue` : days === 0 ? 'today' : `in ${days}d`
  return { text: `${deal.date.label} ${text}`, overdue: days < 0 && !CLOSED.has(deal.stage) }
}
</script>

<template>
  <div class="flex w-full flex-col gap-4">
    <PageActions label="Pipeline actions">
      <Button variant="lime" as-child>
        <NuxtLink :to="kind === 'lead' ? '/leads' : '/tenders'">
          <Icon name="i-lucide-plus" /> New {{ kind }}
        </NuxtLink>
      </Button>
      <Button variant="ghost" as-child>
        <NuxtLink to="/overview">
          Sales dashboard
        </NuxtLink>
      </Button>
      <Button variant="ghost" as-child>
        <NuxtLink to="/bd-reports">
          BD &amp; SM report
        </NuxtLink>
      </Button>
    </PageActions>

    <PageTitle title="Pipeline" description="Drag a card to another stage to move the deal. Cards are sorted by value.">
      <template #aside>
        <PageSegmentedTabs v-model="kind" label="Deal type" :options="[{ value: 'lead', label: 'Leads', count: leads.length }, { value: 'tender', label: 'Tenders', count: tenders.length }]" />
      </template>
    </PageTitle>

    <!-- Filters: one row above the figures and the board -->
    <div class="flex flex-wrap items-center gap-2">
      <div class="relative w-full max-w-xs">
        <Icon name="i-lucide-search" class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input v-model="search" placeholder="Search deals…" class="pl-9" aria-label="Search deals" />
      </div>
      <Select v-model="owner">
        <SelectTrigger class="w-auto min-w-40" aria-label="Owner">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="option in ownerOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </SelectItem>
        </SelectContent>
      </Select>
      <Button v-if="owner !== 'all' || search" variant="ghost" size="sm" @click="owner = 'all'; search = ''">
        Clear filters
      </Button>
    </div>

    <!-- Headline figures -->
    <div class="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.6fr)]">
      <div class="rounded-[28px] bg-brand-forest p-5">
        <div class="text-sm text-brand-mist">
          Open pipeline
        </div>
        <div class="mt-1.5 text-[34px] font-black leading-tight tracking-[-0.04em] text-brand-lime">
          {{ compact.format(kpis.value) }}
        </div>
        <div class="text-[13px] text-white">
          {{ kpis.open }} open {{ kind }}{{ kpis.open === 1 ? '' : 's' }}
        </div>
      </div>
      <div class="rounded-[28px] bg-card p-5 ring-1 ring-black/10 dark:ring-white/10">
        <div class="text-sm text-muted-foreground">
          Weighted
        </div>
        <div class="mt-1.5 text-[34px] font-black leading-tight tracking-[-0.04em] text-foreground">
          {{ compact.format(kpis.weighted) }}
        </div>
        <div class="text-[13px] text-muted-foreground">
          Value × stage probability
        </div>
      </div>
      <div class="rounded-[28px] bg-card p-5 ring-1 ring-black/10 dark:ring-white/10">
        <div class="text-sm text-muted-foreground">
          Win rate
        </div>
        <div class="mt-1.5 text-[34px] font-black leading-tight tracking-[-0.04em] text-foreground">
          {{ kpis.winRate === null ? '—' : `${kpis.winRate}%` }}
        </div>
        <div class="text-[13px] text-muted-foreground">
          {{ kpis.decided }} won or lost
        </div>
      </div>
      <div class="rounded-[28px] bg-card p-5 ring-1 ring-black/10 dark:ring-white/10">
        <div class="text-sm text-muted-foreground">
          Average age
        </div>
        <div class="mt-1.5 text-[34px] font-black leading-tight tracking-[-0.04em] text-foreground">
          {{ kpis.avgAge === null ? '—' : `${kpis.avgAge}d` }}
        </div>
        <div class="text-[13px] text-muted-foreground">
          Of open {{ kind }}s
        </div>
      </div>

      <!-- Value by stage: one series, one hue, so no legend; hover each bar for the figures -->
      <figure class="m-0 flex flex-col gap-2 rounded-[28px] bg-card p-5 ring-1 ring-black/10 sm:col-span-2 xl:col-span-1 dark:ring-white/10">
        <figcaption class="text-sm text-muted-foreground">
          Open value by stage
        </figcaption>
        <ul class="m-0 flex list-none flex-col gap-[2px] p-0">
          <li v-for="column in openColumns" :key="column.value" class="group grid grid-cols-[96px_1fr_56px] items-center gap-2 text-xs">
            <span class="truncate text-muted-foreground">{{ column.label }}</span>
            <span class="relative h-3.5">
              <span
                class="absolute inset-y-0 left-0 rounded-r-[4px] bg-brand-spruce transition-opacity group-hover:opacity-80 dark:bg-brand-lime"
                :style="{ width: column.total ? `${Math.max(2, (column.total / maxStageValue) * 100)}%` : '0' }"
              />
              <span role="tooltip" class="pointer-events-none absolute -top-8 left-0 z-10 hidden whitespace-nowrap rounded-lg bg-popover px-2 py-1 text-xs text-popover-foreground shadow ring-1 ring-black/10 group-hover:block">
                {{ column.label }}: {{ whole.format(column.total) }} · {{ column.cards.length }} deal{{ column.cards.length === 1 ? '' : 's' }}
              </span>
            </span>
            <span class="text-right font-semibold tabular-nums text-foreground">{{ column.total ? compact.format(column.total) : '—' }}</span>
          </li>
        </ul>
      </figure>
    </div>

    <!-- Board -->
    <div class="-mx-1 overflow-x-auto pb-2">
      <div class="flex min-w-max gap-3 px-1">
        <section
          v-for="column in columns"
          :key="column.value"
          :aria-label="`${column.label}: ${column.cards.length} deals`"
          class="flex w-[280px] shrink-0 flex-col gap-2.5 rounded-[28px] p-3 transition-colors"
          :class="[
            dropTarget === column.value ? 'bg-brand-mist ring-2 ring-brand-forest dark:bg-brand-spruce' : column.closed ? 'bg-muted/50' : 'bg-brand-fog dark:bg-muted',
          ]"
          @dragover.prevent="dropTarget = column.value"
          @dragleave="dropTarget === column.value && (dropTarget = null)"
          @drop.prevent="onDrop(column.value)"
        >
          <header class="flex flex-col gap-0.5 px-2 pt-1">
            <div class="flex items-center justify-between gap-2">
              <h2 class="m-0 text-sm font-bold text-foreground">
                {{ column.label }}
              </h2>
              <span class="rounded-full bg-card px-2 py-0.5 text-xs font-bold text-foreground ring-1 ring-black/10">{{ column.cards.length }}</span>
            </div>
            <div class="text-xs text-muted-foreground">
              {{ whole.format(column.total) }}<template v-if="!column.closed && column.total">
                · weighted {{ compact.format(column.weighted) }} ({{ column.probability }}%)
              </template>
            </div>
          </header>

          <template v-if="!column.closed || showClosed[column.value]">
            <article
              v-for="deal in column.cards"
              :key="deal.id"
              draggable="true"
              class="group/card flex cursor-grab flex-col gap-2 rounded-2xl bg-card p-3 ring-1 ring-black/10 transition-shadow hover:shadow-md active:cursor-grabbing dark:ring-white/10"
              :class="dragging?.id === deal.id ? 'opacity-50' : ''"
              @dragstart="onDragStart($event, deal)"
              @dragend="dragging = null; dropTarget = null"
            >
              <div class="flex items-start justify-between gap-2">
                <NuxtLink :to="`/${deal.kind}s/${deal.id}`" class="min-w-0 text-sm font-semibold leading-snug text-foreground hover:underline" draggable="false">
                  {{ deal.title }}
                </NuxtLink>
                <DropdownMenu>
                  <DropdownMenuTrigger as-child>
                    <Button variant="ghost" size="icon-sm" class="-mr-1 -mt-1 shrink-0" :aria-label="`Move ${deal.title}`">
                      <Icon name="i-lucide-ellipsis" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Move to</DropdownMenuLabel>
                    <DropdownMenuItem v-for="stage in STAGES" :key="stage.value" :disabled="stage.value === deal.stage" @select="move(deal, stage.value)">
                      {{ stage.label }}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem @select="navigateTo(`/${deal.kind}s/${deal.id}`)">
                      Open record
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div v-if="deal.subtitle" class="-mt-1 truncate text-xs text-muted-foreground">
                {{ deal.subtitle }}
              </div>
              <div class="flex items-end justify-between gap-2">
                <span class="text-lg font-black tracking-[-0.03em] text-foreground">{{ deal.value ? whole.format(deal.value) : '—' }}</span>
                <span class="flex -space-x-1.5">
                  <span v-for="name in deal.ownerNames.slice(0, 3)" :key="name" :title="name" class="flex size-7 items-center justify-center rounded-full bg-brand-mist text-[10px] font-bold text-brand-forest ring-2 ring-card">{{ initials(name) }}</span>
                  <span v-if="!deal.ownerNames.length" class="text-xs text-muted-foreground">Unassigned</span>
                </span>
              </div>
              <div class="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span class="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{{ daysSince(deal.stageChangedAt) }}d in stage</span>
                <span v-if="dateBadge(deal)" class="flex items-center gap-1 rounded-full px-2 py-0.5" :class="dateBadge(deal)!.overdue ? 'bg-destructive/10 font-semibold text-destructive' : 'bg-muted text-muted-foreground'">
                  <Icon :name="dateBadge(deal)!.overdue ? 'i-lucide-alarm-clock' : 'i-lucide-calendar'" class="size-3" aria-hidden="true" />
                  {{ dateBadge(deal)!.text }}
                </span>
                <span v-if="deal.converted" class="rounded-full bg-brand-forest px-2 py-0.5 font-semibold text-brand-lime">Client</span>
              </div>
            </article>
            <p v-if="!column.cards.length" class="m-0 rounded-2xl border-2 border-dashed border-black/10 p-4 text-center text-xs text-muted-foreground dark:border-white/10">
              {{ loading ? 'Loading…' : 'Drop a deal here' }}
            </p>
          </template>
          <Button v-if="column.closed && column.cards.length" variant="ghost" size="sm" @click="showClosed[column.value] = !showClosed[column.value]">
            {{ showClosed[column.value] ? 'Hide' : `Show ${column.cards.length}` }}
          </Button>
          <p v-else-if="column.closed && !column.cards.length" class="m-0 rounded-2xl border-2 border-dashed border-black/10 p-4 text-center text-xs text-muted-foreground dark:border-white/10">
            Drop a deal here
          </p>
        </section>
      </div>
    </div>
  </div>
</template>
