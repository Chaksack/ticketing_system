<script setup lang="ts">
import type { AiProvider, AiProviderStatus } from '~/types/ai-provider'
import { toast } from 'vue-sonner'
import { AI_PROVIDERS } from '~/types/ai-provider'

const { settings, fetchAiSettings, connectGemini, saveApiKey, disconnectAi, setPreferred } = useAiProviders()
const route = useRoute()
const router = useRouter()

const AI_ERRORS: Record<string, string> = {
  access_denied: 'Google sign-in was cancelled.',
  no_refresh_token: 'Google didn\'t return a lasting sign-in. Remove this app under your Google Account → Security → Third-party access, then try again.',
  missing_gemini_permission: 'The Gemini permission wasn\'t granted on Google\'s consent screen. Try again and leave it ticked.',
  invalid_state: 'That sign-in link expired. Please try again.',
}

onMounted(async () => {
  await fetchAiSettings()

  if (route.query.ai_connected === 'gemini') {
    const gemini = settings.value?.providers.find(p => p.provider === 'gemini')
    toast('Gemini connected', { description: gemini?.accountLabel ? `Signed in as ${gemini.accountLabel}.` : undefined })
    router.replace({ query: {} })
  }
  else if (typeof route.query.ai_error === 'string') {
    toast.error('Could not connect Gemini', { description: AI_ERRORS[route.query.ai_error] ?? 'Something went wrong during Google sign-in. Please try again.' })
    router.replace({ query: {} })
  }
})

const keyDrafts = reactive<Record<string, string>>({ openai: '', anthropic: '' })
const busy = ref<AiProvider | 'preferred' | null>(null)

function providerMeta(id: AiProvider) {
  return AI_PROVIDERS.find(p => p.id === id)!
}

async function onSaveKey(provider: 'openai' | 'anthropic') {
  busy.value = provider
  try {
    await saveApiKey(provider, keyDrafts[provider] ?? '')
    keyDrafts[provider] = ''
    toast(`${providerMeta(provider).label} connected`, { description: 'Key checked and saved (encrypted).' })
  }
  catch (error: any) {
    toast.error('Could not save key', { description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.' })
  }
  finally {
    busy.value = null
  }
}

async function onDisconnect(status: AiProviderStatus) {
  busy.value = status.provider
  try {
    await disconnectAi(status.provider)
    toast(`${status.label} disconnected`)
  }
  catch (error: any) {
    toast.error('Could not disconnect', { description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.' })
  }
  finally {
    busy.value = null
  }
}

const connected = computed(() => settings.value?.providers.filter(p => p.connected) ?? [])

async function onPreferredChange(value: unknown) {
  busy.value = 'preferred'
  try {
    await setPreferred(value === 'auto' ? null : value as AiProvider)
    toast('Assistant updated', { description: `"Ask AI" now uses ${settings.value?.active.label}.` })
  }
  catch (error: any) {
    toast.error('Could not update', { description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.' })
  }
  finally {
    busy.value = null
  }
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div>
      <h4 class="text-base font-medium">
        AI Assistant
      </h4>
      <p class="text-sm text-muted-foreground">
        Connect your own AI for "Ask AI". Only you can use what you connect here.
      </p>
    </div>

    <p v-if="!settings" class="text-sm text-muted-foreground">
      Loading…
    </p>

    <template v-else>
      <div class="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
        <span>
          "Ask AI" is using: <span class="font-medium">{{ settings.active.label }}</span>
        </span>
        <Select
          v-if="connected.length > 1"
          :model-value="settings.preferred ?? 'auto'"
          :disabled="busy === 'preferred'"
          @update:model-value="onPreferredChange"
        >
          <SelectTrigger class="h-8 w-44 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">
              Automatic
            </SelectItem>
            <SelectItem v-for="option in connected" :key="option.provider" :value="option.provider">
              {{ option.label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div v-for="status in settings.providers" :key="status.provider" class="flex flex-col gap-3 rounded-lg border p-4">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="flex size-9 items-center justify-center rounded-md bg-muted">
              <Icon :name="status.provider === 'gemini' ? 'i-lucide-sparkles' : status.provider === 'openai' ? 'i-lucide-bot' : 'i-lucide-brain'" class="size-5" />
            </div>
            <div class="space-y-0.5">
              <p class="text-sm font-medium">
                {{ status.label }}
              </p>
              <p class="text-sm text-muted-foreground">
                <template v-if="status.connected">
                  Connected{{ status.accountLabel ? ` · ${status.accountLabel}` : '' }}
                </template>
                <template v-else-if="status.method === 'google'">
                  Sign in with your Google account (no API key needed)
                </template>
                <template v-else>
                  Uses your own API key
                </template>
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <Button
              v-if="status.connected"
              size="sm" variant="ghost" class="text-destructive" :disabled="busy === status.provider"
              @click="onDisconnect(status)"
            >
              Disconnect
            </Button>
            <Button v-else-if="status.method === 'google'" size="sm" :disabled="!status.available" @click="connectGemini">
              <Icon name="i-lucide-log-in" class="mr-1.5 h-3.5 w-3.5" />
              Connect with Google
            </Button>
          </div>
        </div>

        <p v-if="status.method === 'google' && !status.available" class="text-xs text-muted-foreground">
          Google sign-in isn't set up on this server yet. Ask an admin (see "AI Assistant: personal providers" in the README).
        </p>

        <div v-if="!status.connected && status.method === 'api_key'" class="flex flex-col gap-1.5">
          <div class="flex gap-2">
            <Input
              v-model="keyDrafts[status.provider]"
              type="password" autocomplete="off"
              :placeholder="`${providerMeta(status.provider).keyPrefix ?? ''}…`"
              class="h-8 text-xs"
            />
            <Button
              size="sm" class="h-8"
              :disabled="!keyDrafts[status.provider]?.trim() || busy === status.provider"
              @click="onSaveKey(status.provider as 'openai' | 'anthropic')"
            >
              {{ busy === status.provider ? 'Checking…' : 'Save Key' }}
            </Button>
          </div>
          <p class="text-xs text-muted-foreground">
            {{ status.provider === 'openai' ? 'OpenAI' : 'Anthropic' }} doesn't allow signing in with a ChatGPT/Claude subscription from other apps, so this needs an API key.
            Create one at
            <a :href="providerMeta(status.provider).keyUrl" target="_blank" rel="noopener" class="underline">{{ providerMeta(status.provider).keyUrl?.replace('https://', '') }}</a>.
            Usage is billed to that key's account.
          </p>
        </div>
      </div>
    </template>
  </div>
</template>
