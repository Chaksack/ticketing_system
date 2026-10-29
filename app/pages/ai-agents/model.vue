<script setup lang="ts">
import type { AiModelSettings } from '~/types/aiAgent'

// AI capabilities → Model settings: the AI connection every AI agent in this workspace uses.
definePageMeta({ middleware: 'agent' })

const model = ref<AiModelSettings | null>(null)
onMounted(async () => {
  model.value = (await fetchUntyped<{ model: AiModelSettings }>('/api/ai-agents/model')).model
})
</script>

<template>
  <div class="flex w-full flex-col gap-4">
    <PageTitle title="Model settings" description="The AI model your AI agents use to answer customers. It speaks on the company's behalf, so it's one setting for the whole workspace." />
    <div class="grid items-start gap-4 lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)]">
      <AiModelSettingsCard v-if="model" :model="model" @saved="value => model = value" />
      <p v-else class="m-0 text-muted-foreground">
        Loading…
      </p>
      <RecordCard title="Which to choose" tone="mist">
        <ul class="m-0 flex list-disc flex-col gap-2 pl-5 text-sm">
          <li><b>Canopy's Claude</b> uses the key set on the server (NUXT_ANTHROPIC_API_KEY). Nothing to paste here.</li>
          <li><b>Your Claude key</b> bills your own Anthropic account. Use a fast model such as Claude Haiku for chat.</li>
          <li><b>OpenAI-compatible</b> works with OpenAI, Azure OpenAI, Groq, OpenRouter or a model you host yourself — paste its base URL, model name and key.</li>
          <li>Keys are stored encrypted and never shown again. <b>Test connection</b> sends a tiny request to check it works.</li>
          <li>If the model stops working, agents hand chats to your team instead of leaving customers waiting.</li>
        </ul>
      </RecordCard>
    </div>
  </div>
</template>
