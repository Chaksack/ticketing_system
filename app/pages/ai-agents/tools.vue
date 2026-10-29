<script setup lang="ts">
import type { AiAgentTool } from '~/types/aiAgent'

// AI capabilities → AI tools: what agents can do besides talk, who has each tool switched on, and
// how often it ran. (AgentDesk's "MCP tools" — external MCP and custom HTTP tools aren't supported yet.)
definePageMeta({ middleware: 'agent' })

interface ToolInfo { value: AiAgentTool, label: string, description: string, callName: string, agents: { id: string, name: string, enabled: boolean }[], callsLast30Days: number }
const tools = ref<ToolInfo[] | null>(null)
onMounted(async () => {
  tools.value = (await fetchUntyped<{ tools: ToolInfo[] }>('/api/ai-agents/tools')).tools
})
const ICONS: Record<AiAgentTool, string> = { search_knowledge: 'i-lucide-book-search', customer_tickets: 'i-lucide-ticket', create_ticket: 'i-lucide-ticket-plus', handoff: 'i-lucide-hand' }
</script>

<template>
  <div class="flex w-full flex-col gap-4">
    <PageTitle title="AI tools" description="Actions your AI agents can take in a conversation. Switch tools on or off per agent in its settings." />

    <div class="grid gap-4 md:grid-cols-2">
      <RecordCard v-for="tool in tools ?? []" :key="tool.value">
        <div class="flex items-start gap-3">
          <span class="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-mist text-brand-forest dark:bg-brand-spruce dark:text-brand-mist"><Icon :name="ICONS[tool.value]" class="size-5" /></span>
          <div class="min-w-0 flex-1">
            <h2 class="m-0 text-lg font-bold text-foreground">
              {{ tool.label }}
            </h2>
            <p class="m-0 text-sm text-muted-foreground">
              {{ tool.description }}
            </p>
            <p class="m-0 mt-1 font-mono text-xs text-muted-foreground">
              {{ tool.callName }}
            </p>
          </div>
          <div class="text-right">
            <div class="text-3xl font-black tracking-[-0.04em] text-foreground">
              {{ tool.callsLast30Days }}
            </div>
            <div class="text-xs text-muted-foreground">
              uses · 30 days
            </div>
          </div>
        </div>
        <div class="flex flex-wrap gap-1.5">
          <NuxtLink v-for="agent in tool.agents" :key="agent.id" :to="`/ai-agents/${agent.id}`" class="rounded-full bg-muted px-3 py-1 text-xs font-semibold hover:bg-brand-mist dark:hover:bg-brand-spruce">
            {{ agent.name }}{{ agent.enabled ? '' : ' (off)' }}
          </NuxtLink>
          <span v-if="!tool.agents.length" class="text-xs text-muted-foreground">No agent uses this tool.</span>
        </div>
      </RecordCard>
      <RecordCard v-if="tools" title="Your own tools" tone="mist">
        <p class="m-0 text-sm">
          Connecting external tools — an MCP server, or an HTTP endpoint in your own system (order status, bookings, account lookups) — isn't available yet. Tell us which systems you'd like agents to reach.
        </p>
      </RecordCard>
    </div>
    <p v-if="!tools" class="m-0 text-muted-foreground">
      Loading…
    </p>
  </div>
</template>
