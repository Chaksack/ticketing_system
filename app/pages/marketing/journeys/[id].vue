<script setup lang="ts">
import type { BranchCondition, Journey, JourneyStep, JourneyTrigger, Segment } from '~/types/marketing'
import { toast } from 'vue-sonner'
import { leadStages } from '~/components/leads/data'
import { BRANCH_LABELS, JOURNEY_STEP_LABELS } from '~/types/marketing'

// Journey builder ("Marketing — Journey builder" in the Canopy design).
definePageMeta({ middleware: 'bd' })

const route = useRoute()
const id = computed(() => String(route.params.id))
const { confirm } = useConfirm()

const journey = ref<Journey | null>(null)
const segments = ref<Segment[]>([])
const steps = ref<JourneyStep[]>([])
const settings = reactive({ name: '', trigger: 'segment' as JourneyTrigger, segmentId: '', quietStart: '20:00', quietEnd: '08:00', exitAfterDays: 30 as number | undefined })
const savedSnapshot = ref('')
const selectedId = ref<string | null>(null)

function snapshot() {
  return JSON.stringify([steps.value, settings])
}
function fill(next: Journey) {
  journey.value = next
  steps.value = structuredClone(toRaw(next.steps))
  Object.assign(settings, { name: next.name, trigger: next.trigger, segmentId: next.segmentId ?? '', quietStart: next.quietStart ?? '', quietEnd: next.quietEnd ?? '', exitAfterDays: next.exitAfterDays })
  savedSnapshot.value = snapshot()
}

onMounted(async () => {
  try {
    fill((await fetchUntyped<{ journey: Journey }>(`/api/marketing/journeys/${id.value}`)).journey)
  }
  catch {
    toast.error('Journey not found')
    await navigateTo('/marketing/journeys')
    return
  }
  segments.value = (await fetchUntyped<{ segments: Segment[] }>('/api/marketing/segments')).segments
})
const isDirty = computed(() => !!journey.value && snapshot() !== savedSnapshot.value)

// ── Tree helpers ──────────────────────────────────────────────────────────
function find(stepId: string | null) {
  if (!stepId)
    return null
  const walk = (list: JourneyStep[]): JourneyStep | null => {
    for (const step of list) {
      if (step.id === stepId)
        return step
      if (step.type === 'branch') {
        const found = walk(step.yes) ?? walk(step.no)
        if (found)
          return found
      }
    }
    return null
  }
  return walk(steps.value)
}
function locateAnywhere(stepId: string) {
  const walk = (list: JourneyStep[]): { list: JourneyStep[], index: number } | null => {
    const index = list.findIndex(s => s.id === stepId)
    if (index >= 0)
      return { list, index }
    for (const step of list) {
      if (step.type === 'branch') {
        const found = walk(step.yes) ?? walk(step.no)
        if (found)
          return found
      }
    }
    return null
  }
  return walk(steps.value)
}
const selected = computed(() => find(selectedId.value))

const newStepId = () => Math.random().toString(36).slice(2, 10)
function makeStep(type: JourneyStep['type']): JourneyStep {
  const id = newStepId()
  switch (type) {
    case 'email': return { id, type, subject: '', body: 'Hi {{first_name}},\n\n' }
    case 'wait': return { id, type, days: 3 }
    case 'branch': return { id, type, condition: 'opened_last_email', yes: [], no: [] }
    case 'create_lead': return { id, type, note: '' }
    case 'notify_owner': return { id, type, message: 'is ready for a call' }
  }
}
/** Adds after the selected step (same list), or at the end. */
function addStep(type: JourneyStep['type']) {
  const step = makeStep(type)
  const at = selectedId.value ? locateAnywhere(selectedId.value) : null
  if (at)
    at.list.splice(at.index + 1, 0, step)
  else
    steps.value.push(step)
  selectedId.value = step.id
}
function addToBranch(side: 'yes' | 'no', type: JourneyStep['type']) {
  const branch = selected.value
  if (branch?.type !== 'branch')
    return
  const step = makeStep(type)
  branch[side].push(step)
  selectedId.value = step.id
}
function moveSelected(delta: -1 | 1) {
  const at = selectedId.value ? locateAnywhere(selectedId.value) : null
  if (!at)
    return
  const target = at.index + delta
  if (target < 0 || target >= at.list.length)
    return
  const [step] = at.list.splice(at.index, 1)
  at.list.splice(target, 0, step!)
}
function removeSelected() {
  const at = selectedId.value ? locateAnywhere(selectedId.value) : null
  if (at) {
    at.list.splice(at.index, 1)
    selectedId.value = null
  }
}
// ── Save / publish / test ─────────────────────────────────────────────────
const busy = ref(false)
async function save(action?: 'publish' | 'pause') {
  busy.value = true
  try {
    const { journey: next } = await fetchUntyped<{ journey: Journey }>(`/api/marketing/journeys/${id.value}`, {
      method: 'PATCH',
      body: { ...settings, exitAfterDays: settings.exitAfterDays || null, segmentId: settings.segmentId || null, quietStart: settings.quietStart || null, quietEnd: settings.quietEnd || null, steps: steps.value, action },
    })
    fill(next)
    toast(action === 'publish' ? 'Journey published — it\'s running now' : action === 'pause' ? 'Journey paused' : 'Journey saved')
  }
  catch (error: any) {
    toast.error('Could not save', { description: error?.data?.statusMessage })
  }
  finally {
    busy.value = false
  }
}
defineShortcuts({ meta_s: { usingInput: true, handler: () => isDirty.value && save() } })

async function testJourney() {
  if (isDirty.value)
    await save()
  try {
    const result = await fetchUntyped<{ to: string, subject: string }>(`/api/marketing/journeys/${id.value}/test`, { method: 'POST', body: { stepId: selected.value?.type === 'email' ? selected.value.id : undefined } })
    toast(`Test sent to ${result.to}`, { description: result.subject })
  }
  catch (error: any) {
    toast.error('Test not sent', { description: error?.data?.statusMessage })
  }
}

async function remove() {
  if (!journey.value || !(await confirm({ title: `Delete "${journey.value.name}"?`, description: 'Everyone in it stops receiving its emails.', confirmLabel: 'Delete', destructive: true })))
    return
  await fetchUntyped(`/api/marketing/journeys/${id.value}`, { method: 'DELETE' })
  await navigateTo('/marketing/journeys')
}

// ── Assist ────────────────────────────────────────────────────────────────
const brief = ref('')
const drafting = ref(false)
async function draftEmail() {
  if (selected.value?.type !== 'email' || !brief.value.trim())
    return
  drafting.value = true
  try {
    const result = await fetchUntyped<{ subject: string, body: string }>('/api/marketing/draft-email', { method: 'POST', body: { brief: brief.value, journeyName: settings.name } })
    if (selected.value?.type === 'email') {
      selected.value.subject = result.subject || selected.value.subject
      selected.value.body = result.body
    }
    toast('Draft written — check it over before publishing')
  }
  catch (error: any) {
    toast.error('Assist couldn\'t write it', { description: error?.data?.statusMessage })
  }
  finally {
    drafting.value = false
  }
}

const statusLine = computed(() => {
  if (!journey.value)
    return ''
  const label = { draft: 'Draft', active: 'Live', paused: 'Paused' }[journey.value.status]
  return `Journey · ${label} · saved ${new Date(journey.value.updatedAt).toLocaleString(APP_LOCALE, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}${isDirty.value ? ' · unsaved changes' : ''}`
})
const LIBRARY: JourneyStep['type'][] = ['email', 'wait', 'branch', 'create_lead', 'notify_owner']
</script>

<template>
  <div class="flex w-full flex-col gap-4">
    <MarketingNav />

    <div v-if="journey" class="flex flex-wrap items-end justify-between gap-3">
      <div class="min-w-0 flex-1">
        <div class="text-[13px] font-semibold text-muted-foreground">
          {{ statusLine }}
        </div>
        <label for="journey-name" class="sr-only">Journey name</label>
        <input id="journey-name" v-model="settings.name" class="mt-1.5 w-full bg-transparent text-4xl font-black leading-none tracking-[-0.045em] text-foreground outline-none sm:text-[40px]">
      </div>
      <div class="flex flex-wrap gap-2">
        <Button variant="ghost" class="text-destructive hover:text-destructive" @click="remove">
          Delete
        </Button>
        <Button variant="outline" :disabled="busy || !isDirty" @click="save()">
          Save
        </Button>
        <Button variant="outline" :disabled="busy" @click="testJourney">
          Test journey
        </Button>
        <Button v-if="journey.status === 'active'" variant="outline" :disabled="busy" @click="save('pause')">
          Pause
        </Button>
        <Button v-else variant="lime" :disabled="busy" @click="save('publish')">
          {{ journey.status === 'paused' ? 'Resume' : 'Publish' }}
        </Button>
      </div>
    </div>

    <div v-if="journey" class="flex flex-wrap items-start gap-4">
      <!-- Library -->
      <RecordCard title="Add a step" class="flex-[1_1_220px] sm:max-w-[260px]">
        <button v-for="type in LIBRARY" :key="type" type="button" class="rounded-xl border border-border bg-card px-3.5 py-3 text-left text-sm font-medium text-primary hover:bg-brand-mist dark:text-foreground dark:hover:bg-muted" @click="addStep(type)">
          {{ JOURNEY_STEP_LABELS[type] }}
        </button>
        <button type="button" disabled class="cursor-not-allowed rounded-xl border border-dashed border-border px-3.5 py-3 text-left text-sm text-muted-foreground" title="Needs an SMS/WhatsApp provider to be connected">
          Send SMS / WhatsApp
          <span class="block text-xs">Needs a messaging provider</span>
        </button>
        <p class="m-0 text-xs text-muted-foreground">
          New steps go after the one you've selected.
        </p>
      </RecordCard>

      <!-- Flow -->
      <section aria-label="Journey flow" class="flex min-w-0 flex-[999_1_520px] flex-col items-center rounded-[28px] bg-brand-fog p-7 dark:bg-muted/40">
        <div class="w-[300px] max-w-full rounded-2xl bg-brand-forest px-4 py-3.5 text-white">
          <div class="text-[11px] font-bold uppercase tracking-[0.08em] text-brand-lime">
            Trigger
          </div>
          <div class="mt-1 font-semibold">
            {{ settings.trigger === 'demo_request' ? 'Website demo form submitted' : `Joins "${segments.find(s => s.id === settings.segmentId)?.name ?? 'choose a segment'}"` }}
          </div>
        </div>
        <MarketingJourneyFlow :steps="steps" :selected-id="selectedId" @select="(sid: string) => selectedId = sid" />
        <div aria-hidden="true" class="h-7 w-0.5 bg-brand-forest dark:bg-brand-lime" />
        <div class="rounded-full bg-card px-4 py-2 text-[13px] font-semibold text-brand-forest ring-1 ring-black/10 dark:text-foreground">
          {{ settings.exitAfterDays ? `Exit after ${settings.exitAfterDays} days` : 'End' }}
        </div>
      </section>

      <!-- Settings & step editor -->
      <aside class="flex flex-[1_1_280px] flex-col gap-3.5 sm:max-w-[340px]">
        <RecordCard v-if="selected" :title="JOURNEY_STEP_LABELS[selected.type]">
          <template #actions>
            <span class="flex">
              <Button size="icon-sm" variant="ghost" aria-label="Move up" @click="moveSelected(-1)"><Icon name="i-lucide-arrow-up" /></Button>
              <Button size="icon-sm" variant="ghost" aria-label="Move down" @click="moveSelected(1)"><Icon name="i-lucide-arrow-down" /></Button>
              <Button size="icon-sm" variant="ghost" aria-label="Remove step" class="text-destructive" @click="removeSelected"><Icon name="i-lucide-trash-2" /></Button>
            </span>
          </template>
          <template v-if="selected.type === 'email'">
            <Label for="step-subject" class="text-[13px] font-semibold">Subject</Label>
            <Input id="step-subject" v-model="selected.subject" placeholder="e.g. Your sector guide, {{first_name}}" />
            <Label for="step-body" class="text-[13px] font-semibold">Email</Label>
            <Textarea id="step-body" v-model="selected.body" rows="9" class="font-mono text-[13px]" />
            <p class="m-0 text-xs text-muted-foreground">
              Use {{ '\{\{first_name\}\}' }} and {{ '\{\{company\}\}' }}. **bold**, - bullets and [links](https://…) work. An unsubscribe link is added automatically.
            </p>
          </template>
          <template v-else-if="selected.type === 'wait'">
            <Label for="step-days" class="text-[13px] font-semibold">Days</Label>
            <Input id="step-days" v-model.number="selected.days" type="number" min="1" max="365" />
          </template>
          <template v-else-if="selected.type === 'branch'">
            <Label class="text-[13px] font-semibold">Condition</Label>
            <Select v-model="selected.condition">
              <SelectTrigger class="w-full" aria-label="Condition">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="(label, value) in BRANCH_LABELS" :key="value" :value="value">
                  {{ label }}
                </SelectItem>
              </SelectContent>
            </Select>
            <Select v-if="selected.condition === ('lead_stage_is' as BranchCondition)" v-model="selected.value">
              <SelectTrigger class="w-full" aria-label="Stage">
                <SelectValue placeholder="Stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="stage in leadStages" :key="stage.value" :value="stage.value">
                  {{ stage.label }}
                </SelectItem>
              </SelectContent>
            </Select>
            <div class="grid grid-cols-2 gap-2">
              <DropdownMenu v-for="side in (['yes', 'no'] as const)" :key="side">
                <DropdownMenuTrigger as-child>
                  <Button variant="outline" size="sm">
                    + {{ side === 'yes' ? 'Yes' : 'No' }} step
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem v-for="type in LIBRARY" :key="type" @select="addToBranch(side, type)">
                    {{ JOURNEY_STEP_LABELS[type] }}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </template>
          <template v-else-if="selected.type === 'create_lead'">
            <p class="m-0 text-sm text-muted-foreground">
              Creates a lead (if they don't already have one) and auto-assigns it like any new lead.
            </p>
            <Label for="step-note" class="text-[13px] font-semibold">Note for Sales</Label>
            <Textarea id="step-note" v-model="selected.note" rows="2" />
          </template>
          <template v-else-if="selected.type === 'notify_owner'">
            <Label for="step-message" class="text-[13px] font-semibold">Message to the record's owner</Label>
            <Input id="step-message" v-model="selected.message" />
          </template>
        </RecordCard>

        <RecordCard title="Audience">
          <Label class="text-[13px] font-semibold">Who enters</Label>
          <Select v-model="settings.trigger">
            <SelectTrigger class="w-full" aria-label="Trigger">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="segment">
                Members of a segment
              </SelectItem>
              <SelectItem value="demo_request">
                New website demo requests
              </SelectItem>
            </SelectContent>
          </Select>
          <template v-if="settings.trigger === 'segment'">
            <Label class="text-[13px] font-semibold">Segment</Label>
            <Select v-model="settings.segmentId">
              <SelectTrigger class="w-full" aria-label="Segment">
                <SelectValue placeholder="Choose a segment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="segment in segments" :key="segment.id" :value="segment.id">
                  {{ segment.name }}
                </SelectItem>
              </SelectContent>
            </Select>
            <NuxtLink to="/marketing/segments/new" class="text-xs font-semibold text-primary underline-offset-2 hover:underline dark:text-brand-lime">
              New segment
            </NuxtLink>
          </template>
          <Label class="text-[13px] font-semibold">Quiet hours (GMT)</Label>
          <div class="grid grid-cols-2 gap-2">
            <Input v-model="settings.quietStart" type="time" aria-label="Quiet from" />
            <Input v-model="settings.quietEnd" type="time" aria-label="Quiet until" />
          </div>
          <Label for="exit-days" class="text-[13px] font-semibold">Exit after (days)</Label>
          <Input id="exit-days" v-model.number="settings.exitAfterDays" type="number" min="1" max="365" />
        </RecordCard>

        <RecordCard tone="forest">
          <span class="self-start rounded-full bg-brand-lime px-2.5 py-1 text-xs font-bold text-brand-forest">Canopy Assist</span>
          <template v-if="selected?.type === 'email'">
            <p class="m-0 text-sm">
              Tell me what this email should say and I'll draft it.
            </p>
            <Textarea v-model="brief" rows="3" class="border-brand-lime bg-brand-forest text-white placeholder:text-brand-mist/70" placeholder="e.g. Share a short customer story for their sector and invite them to a 30-minute demo" aria-label="What the email should say" />
            <Button variant="lime" class="self-start" :disabled="drafting || !brief.trim()" @click="draftEmail">
              {{ drafting ? 'Writing…' : 'Write it' }}
            </Button>
          </template>
          <p v-else class="m-0 text-sm text-brand-mist">
            Select an email step and I can draft it for you.
          </p>
        </RecordCard>

        <RecordCard title="Results">
          <dl class="m-0 grid grid-cols-2 gap-2 text-sm">
            <div class="rounded-xl bg-muted/60 p-3">
              <dt class="text-xs text-muted-foreground">
                In journey now
              </dt><dd class="m-0 text-xl font-black">
                {{ journey.stats.active }}
              </dd>
            </div>
            <div class="rounded-xl bg-muted/60 p-3">
              <dt class="text-xs text-muted-foreground">
                Completed
              </dt><dd class="m-0 text-xl font-black">
                {{ journey.stats.completed }}
              </dd>
            </div>
            <div class="rounded-xl bg-muted/60 p-3">
              <dt class="text-xs text-muted-foreground">
                Emails sent
              </dt><dd class="m-0 text-xl font-black">
                {{ journey.stats.sent }}
              </dd>
            </div>
            <div class="rounded-xl bg-muted/60 p-3">
              <dt class="text-xs text-muted-foreground">
                Open rate
              </dt><dd class="m-0 text-xl font-black">
                {{ journey.stats.sent ? `${Math.round(journey.stats.opened / journey.stats.sent * 100)}%` : '—' }}
              </dd>
            </div>
          </dl>
          <p class="m-0 text-xs text-muted-foreground">
            Opens are counted when the recipient's email app loads images, so the real rate is usually higher.
          </p>
        </RecordCard>
      </aside>
    </div>
    <p v-else class="text-sm text-muted-foreground">
      Loading…
    </p>
  </div>
</template>
