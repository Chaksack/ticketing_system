<script setup lang="ts">
import type { CareEvaluation } from '~/types/care'
import { toast } from 'vue-sonner'

// "Canopy Care — quality scoring" in the Canopy design.
definePageMeta({ middleware: 'platform' })

interface ReviewItem { orgId: string, orgName: string, engagementId: string, kind: 'chat' | 'ticket', id: string, title: string, agentName: string, at: string }
interface Transcript { title: string, customer: string, messages: { id: string, author: string, fromCustomer: boolean, system: boolean, body: string, at: string }[] }
type Result = 'met' | 'partly' | 'missed'

const toReview = ref<ReviewItem[]>([])
const evaluations = ref<CareEvaluation[]>([])
const scorecards = ref<Record<string, { label: string, weight: number }[]>>({})
const selected = ref<ReviewItem | null>(null)
const transcript = ref<Transcript | null>(null)
const results = reactive<Record<string, Result>>({})
const note = ref('')
const share = ref(true)

async function load() {
  const data = await fetchUntyped<{ toReview: ReviewItem[], evaluations: CareEvaluation[], scorecards: Record<string, { label: string, weight: number }[]> }>('/api/care/quality')
  toReview.value = data.toReview
  evaluations.value = data.evaluations
  scorecards.value = data.scorecards
}
onMounted(load)

const scorecard = computed(() => selected.value ? scorecards.value[selected.value.engagementId] ?? [] : [])
async function pick(item: ReviewItem) {
  selected.value = item
  transcript.value = null
  note.value = ''
  for (const key of Object.keys(results))
    delete results[key]
  transcript.value = await fetchUntyped<Transcript>(`/api/care/desktop/${item.orgId}/${item.kind}/${item.id}`).catch(() => null)
}

const POINTS: Record<Result, number> = { met: 1, partly: 0.5, missed: 0 }
const score = computed(() => {
  const rows = scorecard.value
  const total = rows.reduce((s, r) => s + r.weight, 0)
  if (!total || rows.some(r => !results[r.label]))
    return null
  return Math.round(rows.reduce((s, r) => s + r.weight * POINTS[results[r.label]!], 0) / total * 100)
})

const saving = ref(false)
async function submit() {
  if (!selected.value || score.value === null)
    return
  saving.value = true
  try {
    await fetchUntyped('/api/care/evaluations', {
      method: 'POST',
      body: {
        engagementId: selected.value.engagementId,
        refType: selected.value.kind,
        refId: selected.value.id,
        refTitle: selected.value.title,
        agentName: selected.value.agentName,
        scores: scorecard.value.map(r => ({ label: r.label, weight: r.weight, result: results[r.label] })),
        note: note.value,
        shared: share.value,
      },
    })
    toast(`Evaluation saved · ${score.value}%`)
    selected.value = null
    transcript.value = null
    await load()
  }
  catch (e: any) {
    toast.error('Not saved', { description: e?.data?.statusMessage })
  }
  finally {
    saving.value = false
  }
}
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
</script>

<template>
  <div class="flex w-full flex-col gap-4">
    <CareNav />

    <div class="flex flex-wrap items-start gap-4">
      <RecordCard title="To evaluate" class="flex-[1_1_280px] lg:max-w-[340px]">
        <button v-for="item in toReview" :key="`${item.orgId}-${item.kind}-${item.id}`" type="button" class="flex flex-col gap-0.5 rounded-2xl p-3 text-left" :class="selected?.id === item.id && selected.orgId === item.orgId ? 'bg-brand-mist ring-2 ring-brand-forest dark:bg-brand-spruce' : 'ring-1 ring-black/10 hover:bg-muted dark:ring-white/10'" @click="pick(item)">
          <span class="text-xs font-semibold text-muted-foreground">{{ item.orgName }} · {{ item.kind === 'chat' ? 'Web chat' : 'Email' }} · {{ when(item.at) }}</span>
          <span class="font-semibold text-foreground">{{ item.title }}</span>
          <span class="text-xs text-muted-foreground">Agent: {{ item.agentName || 'Unknown' }}</span>
        </button>
        <p v-if="!toReview.length" class="m-0 text-sm text-muted-foreground">
          No Care conversations from the last 14 days left to score.
        </p>
      </RecordCard>

      <section class="flex min-w-0 flex-[999_1_480px] flex-col gap-4">
        <template v-if="selected">
          <div>
            <div class="text-[13px] font-semibold text-muted-foreground">
              Evaluation · {{ selected.orgName }} scorecard · agent {{ selected.agentName || 'unknown' }} · {{ selected.kind === 'chat' ? 'web chat' : 'email' }}
            </div>
            <h1 class="m-0 mt-1.5 text-3xl font-black leading-none tracking-[-0.045em] text-foreground sm:text-[40px]">
              {{ selected.title }}
            </h1>
          </div>
          <RecordCard title="Transcript">
            <div class="flex max-h-[40vh] flex-col gap-2 overflow-y-auto text-sm">
              <p v-for="message in transcript?.messages ?? []" :key="message.id" class="m-0" :class="message.system ? 'text-xs text-muted-foreground' : ''">
                <span class="font-mono text-xs text-muted-foreground">{{ new Date(message.at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) }}</span>
                <b class="ml-1.5">{{ message.fromCustomer ? 'Customer' : message.author }}</b> — {{ message.body }}
              </p>
              <p v-if="!transcript" class="m-0 text-muted-foreground">
                Loading…
              </p>
            </div>
          </RecordCard>
        </template>
        <div v-else class="flex min-h-[30vh] items-center justify-center rounded-[28px] bg-card p-10 text-center text-muted-foreground ring-1 ring-black/10 dark:ring-white/10">
          Pick a conversation to score it against the client's scorecard.
        </div>

        <RecordCard title="Recent evaluations">
          <div v-for="evaluation in evaluations.slice(0, 15)" :key="evaluation.id" class="flex flex-wrap justify-between gap-2 border-b border-border py-2 text-sm last:border-0">
            <span><b class="text-foreground">{{ evaluation.refTitle }}</b> · {{ evaluation.orgName }} · {{ evaluation.agentName ?? '—' }}</span>
            <span class="font-bold" :class="evaluation.score >= 85 ? 'text-primary dark:text-brand-lime' : evaluation.score >= 70 ? '' : 'text-destructive'">{{ evaluation.score }}%<span v-if="evaluation.shared" class="ml-1.5 text-xs font-normal text-muted-foreground">shared</span></span>
          </div>
          <p v-if="!evaluations.length" class="m-0 text-sm text-muted-foreground">
            None yet.
          </p>
        </RecordCard>
      </section>

      <aside v-if="selected" class="flex flex-[1_1_300px] flex-col gap-4 lg:max-w-[380px]">
        <RecordCard>
          <div class="flex items-center justify-between">
            <h2 class="m-0 text-lg font-bold text-foreground">
              Scorecard
            </h2>
            <span class="text-3xl font-black tracking-[-0.04em] text-primary dark:text-brand-lime">{{ score === null ? '—' : `${score}%` }}</span>
          </div>
          <fieldset v-for="row in scorecard" :key="row.label" class="m-0 flex flex-col gap-1.5 border-0 p-0">
            <legend class="flex w-full justify-between text-sm font-semibold">
              <span>{{ row.label }}</span><span class="text-xs text-muted-foreground">{{ row.weight }}%</span>
            </legend>
            <div class="grid grid-cols-3 gap-1.5" role="radiogroup" :aria-label="row.label">
              <button
                v-for="option in (['met', 'partly', 'missed'] as const)"
                :key="option"
                type="button"
                role="radio"
                :aria-checked="results[row.label] === option"
                class="min-h-10 rounded-xl text-sm font-semibold capitalize"
                :class="results[row.label] === option ? (option === 'missed' ? 'bg-destructive text-white' : 'bg-brand-lime text-brand-forest ring-2 ring-brand-forest') : 'bg-card ring-1 ring-[#868685]'"
                @click="results[row.label] = option"
              >
                {{ option }}
              </button>
            </div>
          </fieldset>
          <Label for="qa-note" class="text-[13px] font-semibold">Coaching note</Label>
          <Textarea id="qa-note" v-model="note" rows="3" />
          <label class="flex items-center gap-2 text-sm">
            <Checkbox v-model="share" /> Share with client (counts in their results)
          </label>
          <Button variant="lime" :disabled="saving || score === null" @click="submit">
            Submit evaluation
          </Button>
        </RecordCard>
      </aside>
    </div>
  </div>
</template>
