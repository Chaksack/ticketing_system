<script setup lang="ts">
import type { AiModelProvider, AiModelSettings } from '~/types/aiAgent'
import { toast } from 'vue-sonner'

/**
 * The workspace's AI connection for AI agents (AI capabilities → Model settings): provider, model,
 * base URL and a write-only API key, with a connection test.
 */
const props = defineProps<{ model: AiModelSettings }>()
const emit = defineEmits<{ saved: [model: AiModelSettings] }>()
const { isAdmin } = useAuth()
const model = ref<AiModelSettings>(props.model)
watch(() => props.model, value => model.value = value)
const modelForm = reactive({ provider: props.model.provider as AiModelProvider, model: props.model.model, baseUrl: props.model.baseUrl, apiKey: '' })
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
watch(model, value => emit('saved', value))
</script>

<template>
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
</template>
