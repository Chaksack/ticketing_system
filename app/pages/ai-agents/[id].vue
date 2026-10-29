<script setup lang="ts">
import type { AiAgent, AiAgentRun, AiAgentStats, AiAgentTool, AiModelSettings, AiRunStep, AiScenario } from '~/types/aiAgent'
import { toast } from 'vue-sonner'
import { AI_OUTCOME_LABELS, AI_TOOL_OPTIONS } from '~/types/aiAgent'

// One AI agent, laid out like the other record forms: command bar, header, Summary · Details ·
// Related (Playbooks, Activity, Knowledge gaps). The playground on Summary tests the settings on
// screen — saved or not — without touching real customers.
definePageMeta({ middleware: 'agent' })

const route = useRoute()
const { isAdmin } = useAuth()
const { confirm } = useConfirm()
const id = computed(() => String(route.params.id))

const agent = ref<AiAgent | null>(null)
const form = ref<AiAgent | null>(null)
const stats = ref<AiAgentStats | null>(null)
const runs = ref<AiAgentRun[]>([])
const gaps = ref<AiAgentRun[]>([])
const products = ref<string[]>([])
const model = ref<AiModelSettings | null>(null)
const notFound = ref(false)

async function load() {
  try {
    const data = await fetchUntyped<{ agent: AiAgent, stats: AiAgentStats, runs: AiAgentRun[], gaps: AiAgentRun[], products: string[], model: AiModelSettings }>(`/api/ai-agents/${id.value}`)
    agent.value = data.agent
    form.value = structuredClone(toRaw(data.agent))
    stats.value = data.stats
    runs.value = data.runs
    gaps.value = data.gaps
    products.value = data.products
    model.value = data.model
  }
  catch (error: any) {
    if (error?.statusCode === 404)
      notFound.value = true
  }
}
onMounted(load)

const isDirty = computed(() => !!form.value && !!agent.value && JSON.stringify(form.value) !== JSON.stringify(agent.value))
const keywords = computed({
  get: () => form.value?.handoffKeywords.join(', ') ?? '',
  set: (value: string) => {
    if (form.value)
      form.value.handoffKeywords = value.split(',').map(k => k.trim()).filter(Boolean)
  },
})

// ── Command bar ─────────────────────────────────────────────────────────────
const saving = ref(false)
async function save(patch: Partial<AiAgent> = {}) {
  if (!form.value)
    return false
  saving.value = true
  try {
    const { agent: saved } = await fetchUntyped<{ agent: AiAgent }>(`/api/ai-agents/${id.value}`, { method: 'PATCH', body: { ...form.value, ...patch } })
    agent.value = saved
    form.value = structuredClone(toRaw(saved))
    toast('AI agent saved')
    return true
  }
  catch (error: any) {
    toast.error('Not saved', { description: error?.data?.statusMessage })
    return false
  }
  finally {
    saving.value = false
  }
}
async function saveAndClose() {
  if (await save())
    await navigateTo('/ai-agents')
}
async function toggleEnabled() {
  if (form.value)
    await save({ enabled: !agent.value?.enabled })
}
async function remove() {
  if (!agent.value || !await confirm({ title: `Delete ${agent.value.name}?`, description: 'Chats it is handling now go to the team. Past activity stays in the transcripts.', confirmLabel: 'Delete', destructive: true }))
    return
  try {
    await fetchUntyped(`/api/ai-agents/${id.value}`, { method: 'DELETE' })
    toast(`${agent.value.name} deleted`)
    await navigateTo('/ai-agents')
  }
  catch (error: any) {
    toast.error('Not deleted', { description: error?.data?.statusMessage })
  }
}
defineShortcuts({ meta_s: { usingInput: true, handler: () => isDirty.value && save() } })

// ── Tabs ────────────────────────────────────────────────────────────────────
const tab = ref('summary')
const related = computed(() => [
  { value: 'playbooks', label: 'Playbooks', count: form.value?.scenarios.length, icon: 'i-lucide-list-checks' },
  { value: 'activity', label: 'Activity', count: runs.value.length, icon: 'i-lucide-activity' },
  { value: 'gaps', label: 'Knowledge gaps', count: gaps.value.length, icon: 'i-lucide-circle-help' },
])

const SERVICE_MODES = [
  { value: 'ai_first', label: 'AI first, then a person', description: 'Answers first and hands off when it can\'t help or the customer asks.' },
  { value: 'ai_only', label: 'AI only', description: 'Never hands off. Offers to open a ticket instead.' },
  { value: 'human_only', label: 'Off for new chats', description: 'New chats go straight to the team.' },
] as const
const ANSWER_MODES = [
  { value: 'strict', label: 'Only from knowledge', description: 'Every answer must cite an article or a tool result. Otherwise it says it doesn\'t know.' },
  { value: 'flexible', label: 'Flexible', description: 'May answer general questions too, but never invents policies, prices or dates.' },
] as const
const WINDOWS = [
  { value: 'always', label: 'Always' },
  { value: 'business_hours', label: 'During business hours' },
  { value: 'outside_business_hours', label: 'Outside business hours' },
] as const
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function toggleIn<T>(list: T[], value: T) {
  const index = list.indexOf(value)
  if (index === -1)
    list.push(value)
  else
    list.splice(index, 1)
}
function toggleTool(tool: AiAgentTool) {
  if (form.value)
    toggleIn(form.value.tools, tool)
}

// ── Playbooks ───────────────────────────────────────────────────────────────
function addScenario() {
  form.value?.scenarios.push({ id: Math.random().toString(36).slice(2, 10), title: '', trigger: '', instruction: '', enabled: true } satisfies AiScenario)
}
const PLAYBOOK_EXAMPLES: Omit<AiScenario, 'id' | 'enabled'>[] = [
  { title: 'Fault report', trigger: 'Something isn\'t working or is broken', instruction: 'Ask what isn\'t working, where (site or system), and since when. Check the knowledge base for a fix. If there is none, create a high-priority ticket with the details and give the customer the ticket number.' },
  { title: 'Case status', trigger: 'The customer asks about an existing case or ticket', instruction: 'Look up their tickets. Tell them the status of the relevant one in one sentence. If it\'s overdue or they\'re unhappy, hand off to a person.' },
  { title: 'Billing question', trigger: 'Invoices, payments or charges', instruction: 'Answer only from billing articles. For disputes or refunds, don\'t promise anything: hand off to a person with a summary.' },
]
function addExample(example: Omit<AiScenario, 'id' | 'enabled'>) {
  form.value?.scenarios.push({ ...example, id: Math.random().toString(36).slice(2, 10), enabled: true })
}

// ── Playground ──────────────────────────────────────────────────────────────
interface PlayTurn { from: 'customer' | 'ai', text: string, trace?: { outcome: AiAgentRun['outcome'], sources: { id: string, title: string }[], steps: AiRunStep[], handoffReason?: string, error?: string, latencyMs: number } }
const playTurns = ref<PlayTurn[]>([])
const playDraft = ref('')
const playing = ref(false)
const playThread = ref<HTMLElement>()
async function play() {
  const text = playDraft.value.trim()
  if (!text || !form.value || playing.value)
    return
  playTurns.value.push({ from: 'customer', text })
  playDraft.value = ''
  playing.value = true
  try {
    const { result, shown } = await fetchUntyped<{ result: PlayTurn['trace'] & { reply?: string }, shown: string[] }>(`/api/ai-agents/${id.value}/test`, {
      method: 'POST',
      body: { agent: form.value, messages: playTurns.value.map(t => ({ from: t.from, text: t.text })) },
    })
    const replies = shown.length ? shown : ['(no reply)']
    replies.forEach((reply, index) => playTurns.value.push({ from: 'ai', text: reply, trace: index === replies.length - 1 ? result : undefined }))
  }
  catch (error: any) {
    toast.error('Test failed', { description: error?.data?.statusMessage })
  }
  finally {
    playing.value = false
    nextTick(() => playThread.value?.scrollTo({ top: playThread.value.scrollHeight }))
  }
}

// ── Knowledge gaps ──────────────────────────────────────────────────────────
const drafting = ref<string | null>(null)
async function draftArticle(run: AiAgentRun) {
  drafting.value = run.id
  try {
    const { article, aiError } = await fetchUntyped<{ article: { id: string }, aiError?: string }>(`/api/ai-agents/gaps/${run.id}`, { method: 'POST', body: { action: 'draft' } })
    gaps.value = gaps.value.filter(g => g.id !== run.id)
    toast('Draft article created', { description: aiError ? `${aiError} A template was used instead.` : 'Review it, fill in anything marked TO CONFIRM, then publish.' })
    await navigateTo(`/knowledge/${article.id}`)
  }
  catch (error: any) {
    toast.error('No draft', { description: error?.data?.statusMessage })
  }
  finally {
    drafting.value = null
  }
}
async function dismissGap(run: AiAgentRun) {
  await fetchUntyped(`/api/ai-agents/gaps/${run.id}`, { method: 'POST', body: { action: 'dismiss' } }).catch(() => {})
  gaps.value = gaps.value.filter(g => g.id !== run.id)
}

// ── Formatting ──────────────────────────────────────────────────────────────
const when = (iso: string) => new Date(iso).toLocaleString(APP_LOCALE, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const percent = (part: number, whole: number) => whole ? `${Math.round(part / whole * 100)}%` : '—'
const headerStats = computed(() => stats.value
  ? [
      { label: 'Chats (30 days)', value: String(stats.value.conversations) },
      { label: 'Resolved by AI', value: percent(stats.value.resolvedByAi, stats.value.conversations) },
      { label: 'Handed off', value: String(stats.value.handoffs) },
      { label: 'Rollout', value: `${agent.value?.rolloutPercent ?? 0}%` },
    ]
  : [])
function outcomeClass(outcome: AiAgentRun['outcome']) {
  return outcome === 'answered' || outcome === 'clarified' || outcome === 'ticket'
    ? 'bg-brand-mist text-brand-forest dark:bg-brand-spruce dark:text-brand-mist'
    : outcome === 'handoff' ? 'bg-brand-lime text-brand-forest' : outcome === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-100'
}
const modelReady = computed(() => !!model.value && (model.value.provider === 'company' ? model.value.companyKeyAvailable : model.value.hasApiKey))
</script>

<template>
  <div v-if="notFound" class="flex flex-col items-center gap-3 py-20 text-center">
    <p class="m-0 text-muted-foreground">
      This AI agent doesn't exist (any more).
    </p>
    <Button as-child variant="outline">
      <NuxtLink to="/ai-agents">
        Back to AI agents
      </NuxtLink>
    </Button>
  </div>

  <div v-else-if="form && agent" class="mx-auto flex w-full max-w-[1360px] flex-col gap-4">
    <PageActions label="AI agent actions">
      <Button variant="ghost" size="icon" as-child aria-label="Back to AI agents">
        <NuxtLink to="/ai-agents">
          <Icon name="i-lucide-arrow-left" />
        </NuxtLink>
      </Button>
      <template v-if="isAdmin">
        <Button variant="lime" :disabled="saving || !isDirty" @click="save()">
          <Icon name="i-lucide-save" />
          Save
        </Button>
        <Button variant="ghost" :disabled="saving" @click="saveAndClose">
          <Icon name="i-lucide-save-all" />
          Save &amp; close
        </Button>
        <Button variant="ghost" :disabled="saving" @click="toggleEnabled">
          <Icon :name="agent.enabled ? 'i-lucide-pause' : 'i-lucide-play'" />
          {{ agent.enabled ? 'Switch off' : 'Switch on' }}
        </Button>
        <Button variant="ghost" class="text-destructive hover:text-destructive" @click="remove">
          <Icon name="i-lucide-trash-2" />
          Delete
        </Button>
      </template>
    </PageActions>

    <RecordHeader :eyebrow="`AI agent · ${agent.id} · ${agent.enabled ? 'On — answering new chats' : 'Off'}`" :title="agent.name" :subtitle="agent.description || 'Answers live chats from your knowledge base'" :stats="headerStats">
      <p v-if="!modelReady" class="m-0 flex flex-wrap items-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">
        <Icon name="i-lucide-unplug" class="size-4" />
        No AI model is connected, so this agent can't answer yet.
        <NuxtLink to="/ai-agents" class="font-semibold underline">
          Set up the model
        </NuxtLink>
      </p>
    </RecordHeader>

    <RecordTabs v-model="tab" :related="related" />

    <!-- Summary -->
    <div v-if="tab === 'summary'" class="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
      <RecordCard title="Identity">
        <fieldset class="m-0 flex flex-col gap-3 border-0 p-0" :disabled="!isAdmin">
          <div class="flex flex-col gap-1.5">
            <Label for="agent-name">Name customers see</Label>
            <Input id="agent-name" v-model="form.name" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="agent-description">Description (internal)</Label>
            <Input id="agent-description" v-model="form.description" placeholder="e.g. After-sales support for maintenance clients" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="agent-persona">Personality and tone</Label>
            <Textarea id="agent-persona" v-model="form.persona" rows="3" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="agent-welcome">Welcome message</Label>
            <Textarea id="agent-welcome" v-model="form.welcomeMessage" rows="2" />
            <span class="text-xs text-muted-foreground">Sent as soon as a chat starts. Leave empty to go straight to the answer.</span>
          </div>
        </fieldset>
      </RecordCard>

      <RecordCard title="How it answers">
        <fieldset class="m-0 flex flex-col gap-4 border-0 p-0" :disabled="!isAdmin">
          <div class="flex flex-col gap-2" role="radiogroup" aria-label="Service mode">
            <span class="text-sm font-semibold">Service mode</span>
            <button v-for="option in SERVICE_MODES" :key="option.value" type="button" role="radio" :aria-checked="form.serviceMode === option.value" class="flex flex-col rounded-2xl p-3 text-left text-sm" :class="form.serviceMode === option.value ? 'bg-brand-mist ring-2 ring-brand-forest dark:bg-brand-spruce' : 'ring-1 ring-black/10 hover:bg-muted dark:ring-white/10'" @click="form.serviceMode = option.value">
              <span class="font-semibold text-foreground">{{ option.label }}</span>
              <span class="text-xs text-muted-foreground">{{ option.description }}</span>
            </button>
          </div>
          <div class="flex flex-col gap-2" role="radiogroup" aria-label="Answers">
            <span class="text-sm font-semibold">Answers</span>
            <button v-for="option in ANSWER_MODES" :key="option.value" type="button" role="radio" :aria-checked="form.answerMode === option.value" class="flex flex-col rounded-2xl p-3 text-left text-sm" :class="form.answerMode === option.value ? 'bg-brand-mist ring-2 ring-brand-forest dark:bg-brand-spruce' : 'ring-1 ring-black/10 hover:bg-muted dark:ring-white/10'" @click="form.answerMode = option.value">
              <span class="font-semibold text-foreground">{{ option.label }}</span>
              <span class="text-xs text-muted-foreground">{{ option.description }}</span>
            </button>
          </div>
          <div class="flex flex-col gap-2">
            <span class="text-sm font-semibold">Tools it may use</span>
            <label v-for="tool in AI_TOOL_OPTIONS" :key="tool.value" class="flex items-start gap-2.5 text-sm">
              <Checkbox :model-value="form.tools.includes(tool.value)" class="mt-0.5" @update:model-value="toggleTool(tool.value)" />
              <span><span class="font-medium text-foreground">{{ tool.label }}</span><span class="block text-xs text-muted-foreground">{{ tool.description }}</span></span>
            </label>
          </div>
          <div class="flex flex-col gap-2">
            <span class="text-sm font-semibold">Knowledge it uses</span>
            <div v-if="products.length" class="flex flex-wrap gap-1.5">
              <button v-for="product in products" :key="product" type="button" class="rounded-full px-3 py-1 text-xs font-semibold" :class="form.knowledgeProducts.includes(product) ? 'bg-brand-forest text-brand-lime' : 'bg-muted text-muted-foreground'" :aria-pressed="form.knowledgeProducts.includes(product)" @click="toggleIn(form.knowledgeProducts, product)">
                {{ product }}
              </button>
            </div>
            <span class="text-xs text-muted-foreground">{{ form.knowledgeProducts.length ? `Only articles tagged ${form.knowledgeProducts.join(', ')}.` : 'Every published article.' }} <NuxtLink to="/knowledge" class="underline">Knowledge articles</NuxtLink></span>
          </div>
        </fieldset>
      </RecordCard>

      <RecordCard title="Playground" class="lg:col-span-2 2xl:col-span-1">
        <p class="m-0 text-xs text-muted-foreground">
          Chat as a customer to test the settings on screen{{ isDirty ? ' (including unsaved changes)' : '' }}. Nothing is sent to anyone and no tickets are created.
        </p>
        <div ref="playThread" class="flex max-h-[460px] min-h-[220px] flex-col gap-2.5 overflow-y-auto rounded-2xl bg-muted/50 p-3" aria-live="polite">
          <p v-if="!playTurns.length" class="m-auto max-w-[260px] text-center text-sm text-muted-foreground">
            Try a real question from your customers, "I want to talk to a person", or something it shouldn't know.
          </p>
          <template v-for="(turn, index) in playTurns" :key="index">
            <div class="flex max-w-[88%] flex-col gap-1" :class="turn.from === 'customer' ? 'self-end items-end' : 'self-start'">
              <p class="m-0 whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm" :class="turn.from === 'customer' ? 'bg-brand-forest text-white' : 'bg-brand-mist text-brand-obsidian dark:bg-brand-spruce dark:text-white'">
                {{ turn.text }}
              </p>
              <div v-if="turn.trace" class="flex flex-col gap-1 rounded-xl bg-card px-3 py-2 text-xs ring-1 ring-black/10 dark:ring-white/10">
                <span class="flex flex-wrap items-center gap-1.5">
                  <span class="rounded-full px-2 py-0.5 font-bold" :class="outcomeClass(turn.trace.outcome)">{{ AI_OUTCOME_LABELS[turn.trace.outcome] }}</span>
                  <span class="text-muted-foreground">{{ (turn.trace.latencyMs / 1000).toFixed(1) }}s</span>
                </span>
                <span v-if="turn.trace.sources.length">Sources: {{ turn.trace.sources.map(s => s.title).join(', ') }}</span>
                <span v-for="(step, stepIndex) in turn.trace.steps" :key="stepIndex"><span class="font-mono">{{ step.tool }}</span> → {{ step.result }}</span>
                <span v-if="turn.trace.handoffReason">Handoff: {{ turn.trace.handoffReason }}</span>
                <span v-if="turn.trace.error" class="text-destructive">{{ turn.trace.error }}</span>
              </div>
            </div>
          </template>
          <p v-if="playing" class="m-0 flex items-center gap-1 self-start rounded-2xl bg-brand-mist px-3.5 py-2.5 dark:bg-brand-spruce" role="status" aria-label="Thinking">
            <span v-for="dot in 3" :key="dot" class="size-1.5 animate-bounce rounded-full bg-brand-forest dark:bg-brand-lime" :style="{ animationDelay: `${dot * 120}ms` }" />
          </p>
        </div>
        <form v-if="isAdmin" class="flex gap-2" @submit.prevent="play">
          <label for="play-input" class="sr-only">Test message</label>
          <Input id="play-input" v-model="playDraft" placeholder="Ask as a customer…" autocomplete="off" />
          <Button type="submit" variant="lime" :disabled="playing || !playDraft.trim()" aria-label="Send test message">
            <Icon name="i-lucide-arrow-up" />
          </Button>
          <Button type="button" variant="ghost" :disabled="!playTurns.length" @click="playTurns = []">
            Reset
          </Button>
        </form>
      </RecordCard>
    </div>

    <!-- Details -->
    <div v-if="tab === 'details'" class="grid items-start gap-4 lg:grid-cols-2 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)]">
      <RecordCard title="Handoff to a person">
        <fieldset class="m-0 flex flex-col gap-3 border-0 p-0" :disabled="!isAdmin || form.serviceMode !== 'ai_first'">
          <p v-if="form.serviceMode !== 'ai_first'" class="m-0 text-xs text-muted-foreground">
            Only used in "AI first, then a person" mode.
          </p>
          <label class="flex items-center gap-2.5 text-sm">
            <Checkbox v-model="form.handoffOnRequest" /> When the customer asks for a person
          </label>
          <label class="flex items-center gap-2.5 text-sm">
            <Checkbox v-model="form.handoffOnNoAnswer" /> When the knowledge base doesn't cover the question
          </label>
          <div class="flex flex-col gap-1.5">
            <Label for="agent-keywords">Hand off straight away on these words</Label>
            <Input id="agent-keywords" v-model="keywords" placeholder="complaint, cancel my, lawyer" />
            <span class="text-xs text-muted-foreground">Comma-separated. Checked before the AI runs, so it works even if the AI is down.</span>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="agent-handoff">Handoff message</Label>
            <Textarea id="agent-handoff" v-model="form.handoffMessage" rows="2" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="agent-offline">When no one is online</Label>
            <Textarea id="agent-offline" v-model="form.offlineMessage" rows="2" />
            <span class="text-xs text-muted-foreground">A ticket is opened automatically so the question isn't lost.</span>
          </div>
        </fieldset>
        <fieldset class="m-0 flex flex-col gap-1.5 border-0 p-0" :disabled="!isAdmin">
          <Label for="agent-fallback">When it doesn't know</Label>
          <Textarea id="agent-fallback" v-model="form.fallbackMessage" rows="2" />
        </fieldset>
      </RecordCard>

      <RecordCard title="Hours and rollout">
        <fieldset class="m-0 flex flex-col gap-3 border-0 p-0" :disabled="!isAdmin">
          <div class="flex flex-col gap-1.5">
            <span class="text-sm font-semibold">Answers new chats</span>
            <div class="flex flex-wrap gap-1.5" role="radiogroup" aria-label="When it answers">
              <button v-for="option in WINDOWS" :key="option.value" type="button" role="radio" :aria-checked="form.responseWindow === option.value" class="rounded-full px-3 py-1.5 text-xs font-semibold" :class="form.responseWindow === option.value ? 'bg-brand-forest text-brand-lime' : 'bg-muted text-muted-foreground'" @click="form.responseWindow = option.value">
                {{ option.label }}
              </button>
            </div>
          </div>
          <div class="flex flex-col gap-1.5">
            <span class="text-sm font-semibold">Business hours</span>
            <div class="flex flex-wrap gap-1.5">
              <button v-for="(day, index) in DAYS" :key="day" type="button" class="min-w-11 rounded-full px-2.5 py-1.5 text-xs font-semibold" :class="form.hours.days.includes(index) ? 'bg-brand-forest text-brand-lime' : 'bg-muted text-muted-foreground'" :aria-pressed="form.hours.days.includes(index)" @click="toggleIn(form.hours.days, index)">
                {{ day }}
              </button>
            </div>
            <div class="grid grid-cols-3 gap-2">
              <Input v-model="form.hours.start" type="time" aria-label="Opens" />
              <Input v-model="form.hours.end" type="time" aria-label="Closes" />
              <Input v-model="form.hours.timeZone" aria-label="Time zone" placeholder="Africa/Accra" />
            </div>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="agent-rollout">Share of new chats: {{ form.rolloutPercent }}%</Label>
            <input id="agent-rollout" v-model.number="form.rolloutPercent" type="range" min="0" max="100" step="5" class="accent-[#163300]">
            <span class="text-xs text-muted-foreground">Start small and raise it as you trust the answers. The rest go to the team.</span>
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="flex flex-col gap-1.5">
              <Label for="agent-resolve">Close quiet chats after (minutes)</Label>
              <Input id="agent-resolve" v-model.number="form.autoResolveMinutes" type="number" min="0" max="1440" />
              <span class="text-xs text-muted-foreground">0 = never.</span>
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="agent-steps">Steps per reply</Label>
              <Input id="agent-steps" v-model.number="form.maxSteps" type="number" min="1" max="8" />
              <span class="text-xs text-muted-foreground">How many tool calls it may make.</span>
            </div>
          </div>
        </fieldset>
      </RecordCard>

      <div class="flex flex-col gap-4 lg:col-span-2 2xl:col-span-1">
        <RecordCard title="Rules it always follows">
          <Textarea v-model="form.guardrails" rows="6" :disabled="!isAdmin" aria-label="Rules" />
          <span class="text-xs text-muted-foreground">One per line — e.g. what it must never promise or discuss.</span>
        </RecordCard>
        <RecordCard title="Record information">
          <dl class="m-0 grid gap-3 text-sm">
            <div>
              <dt class="text-xs text-muted-foreground">
                ID
              </dt>
              <dd class="m-0 font-semibold text-foreground">
                {{ agent.id }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted-foreground">
                Created on
              </dt>
              <dd class="m-0 text-foreground">
                {{ when(agent.createdAt) }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted-foreground">
                Modified on
              </dt>
              <dd class="m-0 text-foreground">
                {{ when(agent.updatedAt) }}<template v-if="agent.updatedBy">
                  by {{ agent.updatedBy }}
                </template>
              </dd>
            </div>
          </dl>
        </RecordCard>
      </div>
    </div>

    <!-- Related: Playbooks -->
    <RecordCard v-if="tab === 'playbooks'" title="Playbooks">
      <template #actions>
        <Button v-if="isAdmin" size="sm" variant="outline" @click="addScenario">
          <Icon name="i-lucide-plus" />
          Add playbook
        </Button>
      </template>
      <p class="m-0 text-sm text-muted-foreground">
        Step-by-step instructions for situations that come up often. The agent follows the one that matches.
      </p>
      <div v-for="(scenario, index) in form.scenarios" :key="scenario.id" class="flex flex-col gap-2 rounded-2xl p-4 ring-1 ring-black/10 dark:ring-white/10">
        <fieldset class="m-0 flex flex-col gap-2 border-0 p-0" :disabled="!isAdmin">
          <div class="flex flex-wrap items-center gap-2">
            <Input v-model="scenario.title" placeholder="Name, e.g. Fault report" class="max-w-xs font-semibold" :aria-label="`Playbook ${index + 1} name`" />
            <label class="flex items-center gap-2 text-sm">
              <Switch v-model="scenario.enabled" :aria-label="`${scenario.title || 'Playbook'} on or off`" /> {{ scenario.enabled ? 'On' : 'Off' }}
            </label>
            <Button variant="ghost" size="icon-sm" class="ml-auto text-destructive hover:text-destructive" :aria-label="`Remove ${scenario.title || 'playbook'}`" @click="form.scenarios.splice(index, 1)">
              <Icon name="i-lucide-trash-2" />
            </Button>
          </div>
          <Input v-model="scenario.trigger" placeholder="When… e.g. the customer reports a fault" :aria-label="`Playbook ${index + 1} trigger`" />
          <Textarea v-model="scenario.instruction" rows="3" placeholder="What to do, step by step" :aria-label="`Playbook ${index + 1} steps`" />
        </fieldset>
      </div>
      <div v-if="isAdmin" class="flex flex-col gap-2">
        <span class="text-xs font-semibold text-muted-foreground">Start from an example</span>
        <div class="flex flex-wrap gap-2">
          <Button v-for="example in PLAYBOOK_EXAMPLES" :key="example.title" size="sm" variant="outline" @click="addExample(example)">
            {{ example.title }}
          </Button>
        </div>
      </div>
    </RecordCard>

    <!-- Related: Activity -->
    <RecordCard v-if="tab === 'activity'" title="Activity">
      <p class="m-0 text-sm text-muted-foreground">
        Every reply the agent wrote, why, and what it looked at. Test runs from the playground are marked.
      </p>
      <div class="overflow-x-auto">
        <Table class="[&_th]:h-10 [&_th]:text-[13px] [&_th]:font-semibold">
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Customer asked</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead>Sources and tools</TableHead>
              <TableHead class="text-right">
                Time
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="run in runs" :key="run.id">
              <TableCell class="whitespace-nowrap text-xs text-muted-foreground">
                {{ when(run.createdAt) }}
                <NuxtLink v-if="run.chatId" :to="`/inbox?open=${run.chatId}`" class="block font-semibold text-primary hover:underline dark:text-brand-lime">
                  {{ run.chatId }}
                </NuxtLink>
                <span v-else-if="run.dryRun" class="block font-semibold">Test</span>
              </TableCell>
              <TableCell class="max-w-[22rem] text-sm">
                <div class="line-clamp-2">
                  {{ run.question }}
                </div>
                <div v-if="run.reply" class="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  → {{ run.reply }}
                </div>
              </TableCell>
              <TableCell>
                <span class="whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold" :class="outcomeClass(run.outcome)">{{ AI_OUTCOME_LABELS[run.outcome] }}</span>
                <div v-if="run.handoffReason" class="mt-1 text-xs text-muted-foreground">
                  {{ run.handoffReason }}
                </div>
              </TableCell>
              <TableCell class="max-w-[18rem] text-xs text-muted-foreground">
                <div v-if="run.sources.length">
                  {{ run.sources.map(s => s.title).join(', ') }}
                </div>
                <div v-for="(step, index) in run.steps" :key="index">
                  <span class="font-mono">{{ step.tool }}</span> → {{ step.result }}
                </div>
                <div v-if="run.error" class="text-destructive">
                  {{ run.error }}
                </div>
              </TableCell>
              <TableCell class="whitespace-nowrap text-right text-xs tabular-nums text-muted-foreground">
                {{ (run.latencyMs / 1000).toFixed(1) }}s
              </TableCell>
            </TableRow>
            <TableRow v-if="!runs.length">
              <TableCell :colspan="5" class="h-20 text-center text-muted-foreground">
                No activity yet.
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </RecordCard>

    <!-- Related: Knowledge gaps -->
    <RecordCard v-if="tab === 'gaps'" title="Knowledge gaps">
      <p class="m-0 text-sm text-muted-foreground">
        Questions from the last 30 days the agent couldn't answer from the knowledge base. Turn them into articles so it can next time.
      </p>
      <div v-for="run in gaps" :key="run.id" class="flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4 ring-1 ring-black/10 dark:ring-white/10">
        <div class="min-w-0 flex-1">
          <div class="font-semibold text-foreground">
            “{{ run.question }}”
          </div>
          <div class="text-xs text-muted-foreground">
            {{ when(run.createdAt) }} · {{ run.handoffReason ?? AI_OUTCOME_LABELS[run.outcome] }}
          </div>
        </div>
        <div class="flex gap-2">
          <Button size="sm" variant="lime" :disabled="drafting === run.id" @click="draftArticle(run)">
            <Icon name="i-lucide-file-plus" />
            {{ drafting === run.id ? 'Drafting…' : 'Draft article' }}
          </Button>
          <Button size="sm" variant="ghost" @click="dismissGap(run)">
            Dismiss
          </Button>
        </div>
      </div>
      <p v-if="!gaps.length" class="m-0 text-sm text-muted-foreground">
        No gaps — every question had an answer in the knowledge base.
      </p>
    </RecordCard>
  </div>

  <div v-else class="py-20 text-center text-muted-foreground">
    Loading…
  </div>
</template>
