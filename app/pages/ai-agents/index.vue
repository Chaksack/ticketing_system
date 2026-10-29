<script setup lang="ts">
import type { AiAgent, AiAgentStats, AiModelSettings } from '~/types/aiAgent'
import { toast } from 'vue-sonner'

// AI agents: the first responder in live chat. Each agent answers from the knowledge base, can use
// tools (ticket lookup, create ticket, handoff) and passes the chat to a person when it can't help.
definePageMeta({ middleware: 'agent' })

const { isAdmin } = useAuth()
const agents = ref<AiAgent[] | null>(null)
const stats = ref<Record<string, AiAgentStats>>({})
const model = ref<AiModelSettings | null>(null)

async function load() {
  const data = await fetchUntyped<{ agents: AiAgent[], stats: Record<string, AiAgentStats>, model: AiModelSettings }>('/api/ai-agents')
  agents.value = data.agents
  stats.value = data.stats
  model.value = data.model
}
onMounted(load)

const totals = computed(() => Object.values(stats.value).reduce((sum, s) => ({
  conversations: sum.conversations + s.conversations,
  resolvedByAi: sum.resolvedByAi + s.resolvedByAi,
  handoffs: sum.handoffs + s.handoffs,
  fallbacks: sum.fallbacks + s.fallbacks,
}), { conversations: 0, resolvedByAi: 0, handoffs: 0, fallbacks: 0 }))
const modelReady = computed(() => !!model.value && (model.value.provider === 'company' ? model.value.companyKeyAvailable : model.value.hasApiKey))
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

    <div class="flex flex-col gap-4">
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

      <NuxtLink to="/ai-agents/model" class="flex items-center gap-3 rounded-[28px] p-5 ring-1 ring-black/10 transition-colors hover:bg-muted dark:ring-white/10" :class="modelReady ? 'bg-card' : 'bg-amber-50 dark:bg-amber-500/10'">
        <Icon :name="modelReady ? 'i-lucide-plug-zap' : 'i-lucide-unplug'" class="size-5 shrink-0" />
        <span class="min-w-0 flex-1">
          <span class="block font-semibold text-foreground">Model settings</span>
          <span class="block text-sm text-muted-foreground">{{ modelReady ? `Connected · ${model?.model}` : 'Not connected — agents hand every chat to the team until you connect a model' }}</span>
        </span>
        <Icon name="i-lucide-chevron-right" class="size-4 text-muted-foreground" />
      </NuxtLink>
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
