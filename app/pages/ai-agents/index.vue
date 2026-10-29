<script setup lang="ts">
import type { AiAgent, AiAgentStats, AiModelProvider, AiModelSettings } from '~/types/aiAgent'
import { toast } from 'vue-sonner'

// AI agents: the first responder in live chat. Each agent answers from the knowledge base, can use
// tools (ticket lookup, create ticket, handoff) and passes the chat to a person when it can't help.
definePageMeta({ middleware: 'agent' })

const { isAdmin } = useAuth()
const agents = ref<AiAgent[] | null>(null)
const stats = ref<Record<string, AiAgentStats>>({})
const model = ref<AiModelSettings | null>(null)
const modelForm = reactive({ provider: 'company' as AiModelProvider, model: '', baseUrl: '', apiKey: '' })

async function load() {
  const data = await fetchUntyped<{ agents: AiAgent[], stats: Record<string, AiAgentStats>, model: AiModelSettings }>('/api/ai-agents')
  agents.value = data.agents
  stats.value = data.stats
  model.value = data.model
  Object.assign(modelForm, { provider: data.model.provider, model: data.model.model, baseUrl: data.model.baseUrl, apiKey: '' })
}
onMounted(load)

const totals = computed(() => Object.values(stats.value).reduce((sum, s) => ({
  conversations: sum.conversations + s.conversations,
  resolvedByAi: sum.resolvedByAi + s.resolvedByAi,
  handoffs: sum.handoffs + s.handoffs,
  fallbacks: sum.fallbacks + s.fallbacks,
}), { conversations: 0, resolvedByAi: 0, handoffs: 0, fallbacks: 0 }))
const percent = (part: number, whole: number) => whole ? `${Math.round(part / whole * 100)}%` : '—'
const MODE_LABELS = { ai_first: 'AI first, then a person', ai_only: 'AI only', human_only: 'Off for new chats' } as const

// ── New agent ───────────────────────────────────────────────────────────────
const creating = ref(false)
const newName = ref('')
const newOpen = ref(false)
async function create() {
  if (!newName.value.trim())
    return
  creating.value = true
  try {
    const { agent } = await fetchUntyped<{ agent: AiAgent }>('/api/ai-agents', { method: 'POST', body: { name: newName.value } })
    await navigateTo(`/ai-agents/${agent.id}`)
  }
  catch (error: any) {
    toast.error('Not created', { description: error?.data?.statusMessage })
  }
  finally {
    creating.value = false
  }
}

async function toggle(agent: AiAgent, enabled: boolean) {
  try {
    const { agent: updated } = await fetchUntyped<{ agent: AiAgent }>(`/api/ai-agents/${agent.id}`, { method: 'PATCH', body: { enabled } })
    agents.value = (agents.value ?? []).map(a => a.id === updated.id ? updated : a)
    toast(enabled ? `${agent.name} is answering new chats` : `${agent.name} is switched off`)
  }
  catch (error: any) {
    toast.error('Not changed', { description: error?.data?.statusMessage })
  }
}

// ── Model settings ──────────────────────────────────────────────────────────
const PROVIDERS: { value: AiModelProvider, label: string, description: string }[] = [
  { value: 'company', label: 'Canopy\'s Claude', description: 'The server\'s company key (NUXT_ANTHROPIC_API_KEY).' },
  { value: 'anthropic', label: 'Your Claude key', description: 'An Anthropic API key for this workspace.' },
  { value: 'openai', label: 'OpenAI-compatible', description: 'OpenAI, Azure, Groq, OpenRouter, a local model…' },
]
const savingModel = ref(false)
const testResult = ref<{ ok: boolean, latencyMs: number, error?: string } | null>(null)
async function saveModel() {
  savingModel.value = true
  testResult.value = null
  try {
    model.value = (await fetchUntyped<{ model: AiModelSettings }>('/api/ai-agents/model', { method: 'PUT', body: modelForm })).model
    modelForm.apiKey = ''
    toast('AI connection saved')
  }
  catch (error: any) {
    toast.error('Not saved', { description: error?.data?.statusMessage })
  }
  finally {
    savingModel.value = false
  }
}
const testing = ref(false)
async function testModel() {
  testing.value = true
  testResult.value = await fetchUntyped<{ ok: boolean, latencyMs: number, error?: string }>('/api/ai-agents/model/test', { method: 'POST' }).catch((error: any) => ({ ok: false, latencyMs: 0, error: error?.data?.statusMessage }))
  testing.value = false
}
const modelReady = computed(() => !!model.value && (model.value.provider === 'company' ? model.value.companyKeyAvailable : model.value.hasApiKey))
</script>

<template>
  <div class="flex w-full flex-col gap-4">
    <PageActions label="AI agent actions">
      <Button v-if="isAdmin" variant="lime" @click="newOpen = true">
        <Icon name="i-lucide-plus" />
        New AI agent
      </Button>
      <Button variant="ghost" @click="load">
        <Icon name="i-lucide-refresh-cw" />
        Refresh
      </Button>
      <Button variant="ghost" as-child>
        <NuxtLink to="/inbox">
          <Icon name="i-lucide-messages-square" />
          Live chat
        </NuxtLink>
      </Button>
    </PageActions>

    <PageTitle title="AI agents" description="AI agents answer live chats first, from your knowledge base. When they can't help — or the customer asks — they pass the chat to your team with a summary." />

    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div
        v-for="tile in [
          { label: 'Chats the AI took (30 days)', value: totals.conversations },
          { label: 'Resolved without a person', value: percent(totals.resolvedByAi, totals.conversations) },
          { label: 'Handed to the team', value: totals.handoffs },
          { label: 'Questions it couldn\'t answer', value: totals.fallbacks },
        ]" :key="tile.label" class="rounded-[28px] bg-card p-5 ring-1 ring-black/10 dark:ring-white/10"
      >
        <div class="text-sm text-muted-foreground">
          {{ tile.label }}
        </div>
        <div class="mt-1 text-4xl font-black tracking-[-0.04em] text-foreground">
          {{ agents ? tile.value : '—' }}
        </div>
      </div>
    </div>

    <div class="grid items-start gap-4 2xl:grid-cols-[minmax(0,1fr)_380px]">
      <div class="overflow-x-auto rounded-[28px] bg-card px-3 pb-3 pt-1.5 ring-1 ring-black/10 sm:px-5 sm:pb-5 dark:ring-white/10">
        <Table class="[&_th]:h-11 [&_th]:text-[13px] [&_th]:font-semibold">
          <TableHeader>
            <TableRow>
              <TableHead>Agent</TableHead>
              <TableHead>Service mode</TableHead>
              <TableHead>Answers</TableHead>
              <TableHead class="text-right">
                Rollout
              </TableHead>
              <TableHead class="text-right">
                Chats · resolved
              </TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-if="!agents">
              <TableCell :colspan="6" class="h-20 text-center text-muted-foreground">
                Loading…
              </TableCell>
            </TableRow>
            <TableRow v-else-if="!agents.length">
              <TableCell :colspan="6" class="h-28 text-center text-muted-foreground">
                No AI agents yet. {{ isAdmin ? 'Create one, test it in the playground, then switch it on.' : 'Ask an admin to set one up.' }}
              </TableCell>
            </TableRow>
            <TableRow v-for="agent in agents ?? []" :key="agent.id" class="cursor-pointer" @click="navigateTo(`/ai-agents/${agent.id}`)">
              <TableCell>
                <div class="flex items-center gap-3">
                  <span class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-mist text-brand-forest dark:bg-brand-spruce dark:text-brand-mist"><Icon name="i-lucide-bot" class="size-4" /></span>
                  <div class="min-w-0">
                    <div class="font-semibold text-foreground">
                      {{ agent.name }}
                    </div>
                    <div class="line-clamp-1 text-xs text-muted-foreground">
                      {{ agent.description || `${agent.tools.length} tools · ${agent.scenarios.filter(s => s.enabled).length} playbooks` }}
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell class="text-sm">
                {{ MODE_LABELS[agent.serviceMode] }}
              </TableCell>
              <TableCell class="text-sm">
                {{ agent.answerMode === 'strict' ? 'Only from knowledge' : 'Flexible' }}
              </TableCell>
              <TableCell class="text-right tabular-nums">
                {{ agent.rolloutPercent }}%
              </TableCell>
              <TableCell class="text-right tabular-nums">
                {{ stats[agent.id]?.conversations ?? 0 }} · {{ percent(stats[agent.id]?.resolvedByAi ?? 0, stats[agent.id]?.conversations ?? 0) }}
              </TableCell>
              <TableCell @click.stop>
                <label class="flex items-center gap-2 text-sm">
                  <Switch :model-value="agent.enabled" :disabled="!isAdmin" :aria-label="`${agent.name} on or off`" @update:model-value="(value: boolean) => toggle(agent, value)" />
                  {{ agent.enabled ? 'On' : 'Off' }}
                </label>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <RecordCard title="Model settings">
        <p class="m-0 text-sm text-muted-foreground">
          The AI that powers your agents. It answers customers on the company's behalf, so it's set for the whole workspace.
        </p>
        <div class="flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold" :class="modelReady ? 'bg-brand-mist text-brand-forest dark:bg-brand-spruce dark:text-brand-mist' : 'bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-100'">
          <Icon :name="modelReady ? 'i-lucide-plug-zap' : 'i-lucide-unplug'" class="size-4" />
          {{ modelReady ? `Connected · ${model?.model}` : 'Not connected — agents will hand every chat to the team' }}
        </div>
        <fieldset class="m-0 flex flex-col gap-2 border-0 p-0" :disabled="!isAdmin">
          <legend class="mb-1 text-sm font-semibold">
            Provider
          </legend>
          <label v-for="option in PROVIDERS" :key="option.value" class="flex cursor-pointer items-start gap-2.5 rounded-2xl p-3 text-sm" :class="modelForm.provider === option.value ? 'bg-brand-mist ring-2 ring-brand-forest dark:bg-brand-spruce' : 'ring-1 ring-black/10 dark:ring-white/10'">
            <input v-model="modelForm.provider" type="radio" name="ai-provider" :value="option.value" class="mt-1 accent-[#163300]">
            <span>
              <span class="font-semibold text-foreground">{{ option.label }}</span>
              <span class="block text-xs text-muted-foreground">{{ option.value === 'company' ? `${option.description} ${model?.companyKeyAvailable ? 'Set on this server.' : 'Not set on this server.'}` : option.description }}</span>
            </span>
          </label>
        </fieldset>
        <template v-if="isAdmin">
          <div class="flex flex-col gap-1.5">
            <Label for="ai-model">Model</Label>
            <Input id="ai-model" v-model="modelForm.model" autocomplete="off" :placeholder="modelForm.provider === 'openai' ? 'gpt-4.1-mini' : 'claude-haiku-4-5'" />
          </div>
          <div v-if="modelForm.provider === 'openai'" class="flex flex-col gap-1.5">
            <Label for="ai-base-url">Base URL</Label>
            <Input id="ai-base-url" v-model="modelForm.baseUrl" autocomplete="off" placeholder="https://api.openai.com/v1" />
          </div>
          <div v-if="modelForm.provider !== 'company'" class="flex flex-col gap-1.5">
            <Label for="ai-key">API key</Label>
            <Input id="ai-key" v-model="modelForm.apiKey" type="password" autocomplete="off" :placeholder="model?.hasApiKey && model.provider === modelForm.provider ? 'Saved — leave blank to keep it' : 'Paste the key'" />
            <span class="text-xs text-muted-foreground">Stored encrypted. Never shown again.</span>
          </div>
          <div class="flex flex-wrap gap-2">
            <Button :disabled="savingModel" @click="saveModel">
              Save connection
            </Button>
            <Button variant="outline" :disabled="testing" @click="testModel">
              {{ testing ? 'Testing…' : 'Test connection' }}
            </Button>
          </div>
          <p v-if="testResult" class="m-0 text-sm" :class="testResult.ok ? 'text-primary dark:text-brand-lime' : 'text-destructive'" role="status">
            {{ testResult.ok ? `Working — replied in ${(testResult.latencyMs / 1000).toFixed(1)}s.` : testResult.error }}
          </p>
        </template>
      </RecordCard>
    </div>

    <Dialog v-model:open="newOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New AI agent</DialogTitle>
          <DialogDescription>It starts switched off with sensible defaults. Test it in the playground, then switch it on.</DialogDescription>
        </DialogHeader>
        <form class="flex flex-col gap-4" @submit.prevent="create">
          <div class="flex flex-col gap-1.5">
            <Label for="agent-name">Name customers will see</Label>
            <Input id="agent-name" v-model="newName" autocomplete="off" placeholder="e.g. Ava" />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" @click="newOpen = false">
              Cancel
            </Button>
            <Button type="submit" variant="lime" :disabled="creating || !newName.trim()">
              Create and configure
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>
</template>
