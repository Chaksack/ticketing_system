<script setup lang="ts">
import type { AiAgent } from '~/types/aiAgent'

// AI capabilities → Playbooks: every agent's step-by-step instructions in one place (AgentDesk's
// "Skills", Chatwoot's "Scenarios"). Edit them on the agent.
definePageMeta({ middleware: 'agent' })

const agents = ref<AiAgent[] | null>(null)
onMounted(async () => {
  agents.value = (await fetchUntyped<{ agents: AiAgent[] }>('/api/ai-agents')).agents
})
const total = computed(() => (agents.value ?? []).reduce((sum, a) => sum + a.scenarios.length, 0))
</script>

<template>
  <div class="flex w-full flex-col gap-4">
    <PageTitle title="Playbooks" description="Step-by-step instructions your AI agents follow in situations that come up often — a fault report, a billing question, a case status check." />

    <p v-if="agents && !agents.length" class="m-0 rounded-[28px] bg-card p-8 text-center text-muted-foreground ring-1 ring-black/10 dark:ring-white/10">
      No AI agents yet. <NuxtLink to="/ai-agents" class="font-semibold underline">
        Create one
      </NuxtLink> to add playbooks.
    </p>

    <RecordCard v-for="agent in agents ?? []" :key="agent.id" :title="`${agent.name} · ${agent.scenarios.length} playbook${agent.scenarios.length === 1 ? '' : 's'}`">
      <template #actions>
        <Button size="sm" variant="outline" as-child>
          <NuxtLink :to="`/ai-agents/${agent.id}?tab=playbooks`">
            <Icon name="i-lucide-pencil" />
            Edit playbooks
          </NuxtLink>
        </Button>
      </template>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <article v-for="scenario in agent.scenarios" :key="scenario.id" class="flex flex-col gap-1.5 rounded-2xl p-4 ring-1 ring-black/10 dark:ring-white/10" :class="scenario.enabled ? '' : 'opacity-60'">
          <div class="flex items-center justify-between gap-2">
            <h3 class="m-0 text-base font-bold text-foreground">
              {{ scenario.title }}
            </h3>
            <span class="rounded-full px-2 py-0.5 text-xs font-semibold" :class="scenario.enabled ? 'bg-brand-mist text-brand-forest dark:bg-brand-spruce dark:text-brand-mist' : 'bg-muted text-muted-foreground'">{{ scenario.enabled ? 'On' : 'Off' }}</span>
          </div>
          <p v-if="scenario.trigger" class="m-0 text-xs font-semibold text-muted-foreground">
            When: {{ scenario.trigger }}
          </p>
          <p class="m-0 line-clamp-4 whitespace-pre-wrap text-sm">
            {{ scenario.instruction }}
          </p>
        </article>
      </div>
      <p v-if="!agent.scenarios.length" class="m-0 text-sm text-muted-foreground">
        No playbooks yet — the agent answers from the knowledge base and its general rules.
      </p>
    </RecordCard>
    <p v-if="agents && agents.length && !total" class="m-0 text-sm text-muted-foreground">
      Tip: start from an example on the agent's Playbooks tab.
    </p>
  </div>
</template>
