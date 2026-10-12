<script setup lang="ts">
import { toast } from 'vue-sonner'
import { CARE_MODELS } from '~/types/care'

// "Canopy Care — client results portal" in the Canopy design, inside the client's own workspace.
definePageMeta({ middleware: 'admin' })

interface Results {
  engagement: null | { stage: string, model: string, agents: number, slaText: string, recommendations: { id: string, text: string, approvedAt?: string, approvedBy?: string }[] }
  month?: string
  handled?: number
  serviceLevel?: number | null
  firstContactResolution?: number | null
  csat?: number | null
  csatResponses?: number
  quality?: number | null
  qualityEvaluations?: number
  reasons?: { label: string, percent: number }[]
}

const { currentOrg } = useAuth()
const data = ref<Results | null>(null)
onMounted(async () => {
  data.value = await fetchUntyped<Results>('/api/care/results')
})

const pending = computed(() => data.value?.engagement?.recommendations.filter(r => !r.approvedAt) ?? [])
async function approve() {
  try {
    const result = await fetchUntyped<{ recommendations: NonNullable<Results['engagement']>['recommendations'] }>('/api/care/results/approve', { method: 'POST', body: { ids: pending.value.map(r => r.id) } })
    if (data.value?.engagement)
      data.value.engagement.recommendations = result.recommendations
    toast('Approved — your success manager has been told')
  }
  catch (e: any) {
    toast.error('Not approved', { description: e?.data?.statusMessage })
  }
}

function downloadReport() {
  if (!data.value)
    return
  downloadCsv(`canopy-care-${data.value.month?.replace(' ', '-').toLowerCase()}.csv`, ['Measure', 'Value'], [
    ['Month', data.value.month],
    ['Conversations handled', data.value.handled],
    ['Service level', data.value.serviceLevel === null ? '' : `${data.value.serviceLevel}%`],
    ['First-contact resolution', data.value.firstContactResolution === null ? '' : `${data.value.firstContactResolution}%`],
    ['Customer satisfaction', data.value.csat === null ? '' : `${data.value.csat} / 5 (${data.value.csatResponses} responses)`],
    ['Quality score', data.value.quality === null ? '' : `${data.value.quality}% (${data.value.qualityEvaluations} evaluations)`],
    ...(data.value.reasons ?? []).map(r => [`Contact reason: ${r.label}`, `${r.percent}%`]),
  ])
}

const pct = (value?: number | null) => value === null || value === undefined ? '—' : `${value}%`
const modelLabel = computed(() => CARE_MODELS.find(m => m.value === data.value?.engagement?.model)?.label)
</script>

<template>
  <div class="mx-auto flex w-full max-w-[1360px] flex-col gap-4">
    <p v-if="!data" class="text-sm text-muted-foreground">
      Loading…
    </p>

    <RecordCard v-else-if="!data.engagement" title="Canopy Care">
      <p class="m-0">
        Canopy Care is Canopy's managed customer-service team: trained agents who answer your customers inside this workspace, under your name, with every conversation visible to you.
      </p>
      <NuxtLink to="/care-service" class="self-start font-semibold text-primary underline dark:text-brand-lime">
        How Canopy Care works
      </NuxtLink>
    </RecordCard>

    <template v-else>
      <PageActions label="Results actions">
        <Button variant="lime" @click="downloadReport">
          <Icon name="i-lucide-download" /> Download monthly report
        </Button>
        <Button variant="ghost" as-child>
          <a href="mailto:care@canopy.com?subject=Business%20review">Book business review</a>
        </Button>
      </PageActions>

      <div>
        <div class="text-[13px] font-semibold text-muted-foreground">
          {{ modelLabel }} · {{ data.engagement.agents }} agent{{ data.engagement.agents === 1 ? '' : 's' }} · {{ data.engagement.slaText }} · {{ data.month }}
        </div>
        <h1 class="m-0 mt-1.5 text-4xl font-black leading-none tracking-[-0.045em] text-foreground sm:text-[44px]">
          Your customer service this month
        </h1>
      </div>

      <div class="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-5">
        <div class="rounded-[28px] bg-brand-forest p-5">
          <div class="text-sm text-brand-mist">
            Conversations handled
          </div>
          <div class="mt-1.5 text-[38px] font-black leading-tight tracking-[-0.04em] text-brand-lime">
            {{ data.handled?.toLocaleString() }}
          </div>
          <div class="text-[13px] text-white">
            Month to date
          </div>
        </div>
        <div class="rounded-[28px] bg-card p-5 ring-1 ring-black/10 dark:ring-white/10">
          <div class="text-sm text-muted-foreground">
            Service level
          </div>
          <div class="mt-1.5 text-[38px] font-black leading-tight tracking-[-0.04em] text-foreground">
            {{ pct(data.serviceLevel) }}
          </div>
          <div class="text-[13px] text-muted-foreground">
            Chats answered within target
          </div>
        </div>
        <div class="rounded-[28px] bg-card p-5 ring-1 ring-black/10 dark:ring-white/10">
          <div class="text-sm text-muted-foreground">
            First-contact resolution
          </div>
          <div class="mt-1.5 text-[38px] font-black leading-tight tracking-[-0.04em] text-foreground">
            {{ pct(data.firstContactResolution) }}
          </div>
          <div class="text-[13px] text-muted-foreground">
            Resolved cases, one reply
          </div>
        </div>
        <div class="rounded-[28px] bg-card p-5 ring-1 ring-black/10 dark:ring-white/10">
          <div class="text-sm text-muted-foreground">
            Customer satisfaction
          </div>
          <div class="mt-1.5 text-[38px] font-black leading-tight tracking-[-0.04em] text-foreground">
            {{ data.csat === null ? '—' : `${data.csat} / 5` }}
          </div>
          <div class="text-[13px] text-muted-foreground">
            {{ data.csatResponses }} survey response{{ data.csatResponses === 1 ? '' : 's' }}
          </div>
        </div>
        <div class="rounded-[28px] bg-brand-mist p-5 dark:bg-brand-spruce">
          <div class="text-sm text-brand-spruce dark:text-brand-mist">
            Quality score
          </div>
          <div class="mt-1.5 text-[38px] font-black leading-tight tracking-[-0.04em] text-brand-forest dark:text-brand-lime">
            {{ pct(data.quality) }}
          </div>
          <div class="text-[13px] text-brand-forest dark:text-white">
            {{ data.qualityEvaluations }} evaluation{{ data.qualityEvaluations === 1 ? '' : 's' }}
          </div>
        </div>
      </div>

      <div class="flex flex-wrap items-start gap-4">
        <RecordCard title="Why your customers got in touch" class="flex-[1_1_420px]">
          <ul class="m-0 flex list-none flex-col gap-3 p-0">
            <li v-for="reason in data.reasons" :key="reason.label" class="grid grid-cols-[minmax(0,1fr)_2fr_48px] items-center gap-3 text-sm">
              <span class="truncate font-medium">{{ reason.label }}</span>
              <span class="h-6 rounded-full bg-brand-fog dark:bg-muted"><span class="block h-full rounded-full bg-brand-lime" :style="{ width: `${reason.percent}%` }" /></span>
              <span class="text-right font-semibold tabular-nums">{{ reason.percent }}%</span>
            </li>
          </ul>
          <p v-if="!data.reasons?.length" class="m-0 text-sm text-muted-foreground">
            Nothing handled yet this month.
          </p>
        </RecordCard>
        <RecordCard title="Recommendations from your success manager" tone="mist" class="flex-[1_1_360px]">
          <p v-for="item in data.engagement.recommendations" :key="item.id" class="m-0 text-sm">
            {{ item.text }}<span v-if="item.approvedAt" class="block text-xs font-semibold">Approved by {{ item.approvedBy }}</span>
          </p>
          <p v-if="!data.engagement.recommendations.length" class="m-0 text-sm">
            None yet — they'll appear after your first monthly review.
          </p>
          <Button v-if="pending.length" class="self-start" @click="approve">
            Approve {{ pending.length === 1 ? 'it' : pending.length === 2 ? 'both changes' : `all ${pending.length}` }}
          </Button>
        </RecordCard>
      </div>

      <p class="m-0 rounded-2xl bg-brand-fog p-4 text-sm text-brand-forest dark:bg-muted dark:text-foreground">
        All conversations and records shown here are stored in {{ currentOrg?.name }}'s own Canopy workspace. Replies from Canopy Care agents are labelled "· Canopy Care" on every ticket and chat.
      </p>
    </template>
  </div>
</template>
