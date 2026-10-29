<script setup lang="ts">
import type { AiAgentRun, AiRunOutcome } from '~/types/aiAgent'
import { AI_OUTCOME_LABELS } from '~/types/aiAgent'

// AI capabilities → AI activity: an audit trail of every AI reply across agents — what the customer
// asked, what the agent did (sources, tools, handoffs) and how long it took.
definePageMeta({ middleware: 'agent' })

const runs = ref<AiAgentRun[] | null>(null)
const totals = ref({ runs: 0, inputTokens: 0, outputTokens: 0, avgLatencyMs: 0 })
const agents = ref<{ id: string, name: string }[]>([])
const agentId = ref('all')
const outcome = ref<'all' | AiRunOutcome>('all')
const tests = ref(false)

async function load() {
  const data = await fetchUntyped<{ runs: AiAgentRun[], totals: typeof totals.value, agents: { id: string, name: string }[] }>('/api/ai-agents/runs', {
    query: { agentId: agentId.value === 'all' ? undefined : agentId.value, outcome: outcome.value === 'all' ? undefined : outcome.value, tests: tests.value ? '1' : undefined },
  })
  runs.value = data.runs
  totals.value = data.totals
  agents.value = data.agents
}
onMounted(load)
watch([agentId, outcome, tests], load)

const when = (iso: string) => new Date(iso).toLocaleString(APP_LOCALE, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
function outcomeClass(value: AiRunOutcome) {
  return value === 'answered' || value === 'clarified' || value === 'ticket'
    ? 'bg-brand-mist text-brand-forest dark:bg-brand-spruce dark:text-brand-mist'
    : value === 'handoff' ? 'bg-brand-lime text-brand-forest' : value === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-100'
}
</script>

<template>
  <div class="flex w-full flex-col gap-4">
    <PageTitle title="AI activity" description="Every reply your AI agents wrote — what the customer asked, what the agent looked at, and what it decided.">
      <template #aside>
        <div class="flex flex-wrap items-center gap-2">
          <Select v-model="agentId">
            <SelectTrigger class="w-44" aria-label="Agent">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                All agents
              </SelectItem>
              <SelectItem v-for="agent in agents" :key="agent.id" :value="agent.id">
                {{ agent.name }}
              </SelectItem>
            </SelectContent>
          </Select>
          <Select v-model="outcome">
            <SelectTrigger class="w-48" aria-label="Outcome">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                All outcomes
              </SelectItem>
              <SelectItem v-for="(label, key) in AI_OUTCOME_LABELS" :key="key" :value="key">
                {{ label }}
              </SelectItem>
            </SelectContent>
          </Select>
          <label class="flex items-center gap-2 text-sm">
            <Checkbox v-model="tests" /> Include tests
          </label>
        </div>
      </template>
    </PageTitle>

    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div
        v-for="tile in [
          { label: 'Replies shown', value: totals.runs },
          { label: 'Average time', value: `${(totals.avgLatencyMs / 1000).toFixed(1)}s` },
          { label: 'Tokens in', value: totals.inputTokens.toLocaleString(APP_LOCALE) },
          { label: 'Tokens out', value: totals.outputTokens.toLocaleString(APP_LOCALE) },
        ]" :key="tile.label" class="rounded-[28px] bg-card p-5 ring-1 ring-black/10 dark:ring-white/10"
      >
        <div class="text-sm text-muted-foreground">
          {{ tile.label }}
        </div>
        <div class="mt-1 text-3xl font-black tracking-[-0.04em] text-foreground">
          {{ tile.value }}
        </div>
      </div>
    </div>

    <div class="overflow-x-auto rounded-[28px] bg-card px-3 pb-3 pt-1.5 ring-1 ring-black/10 sm:px-5 sm:pb-5 dark:ring-white/10">
      <Table class="[&_th]:h-11 [&_th]:text-[13px] [&_th]:font-semibold">
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Agent</TableHead>
            <TableHead>Customer asked → reply</TableHead>
            <TableHead>Outcome</TableHead>
            <TableHead>Sources and tools</TableHead>
            <TableHead class="text-right">
              Time
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-if="!runs">
            <TableCell :colspan="6" class="h-20 text-center text-muted-foreground">
              Loading…
            </TableCell>
          </TableRow>
          <TableRow v-else-if="!runs.length">
            <TableCell :colspan="6" class="h-24 text-center text-muted-foreground">
              No AI activity{{ outcome === 'all' ? ' yet' : ' with this outcome' }}.
            </TableCell>
          </TableRow>
          <TableRow v-for="run in runs ?? []" :key="run.id">
            <TableCell class="whitespace-nowrap text-xs text-muted-foreground">
              {{ when(run.createdAt) }}
              <NuxtLink v-if="run.chatId" :to="`/inbox?open=${run.chatId}`" class="block font-semibold text-primary hover:underline dark:text-brand-lime">
                {{ run.chatId }}
              </NuxtLink>
              <span v-else-if="run.dryRun" class="block font-semibold">Playground test</span>
            </TableCell>
            <TableCell class="text-sm">
              <NuxtLink :to="`/ai-agents/${run.agentId}`" class="font-semibold hover:underline">
                {{ run.agentName ?? run.agentId }}
              </NuxtLink>
            </TableCell>
            <TableCell class="max-w-[24rem] text-sm">
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
        </TableBody>
      </Table>
    </div>
  </div>
</template>
