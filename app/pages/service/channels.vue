<script setup lang="ts">
import type { SupportChannel } from '~/types/supportDesk'
import { toast } from 'vue-sonner'

// Support setup → Channels: every way customers reach support. The website chat can be switched on
// or off and embedded on the company's own website with one line of code.
definePageMeta({ middleware: 'agent' })

const { isAdmin } = useAuth()
const channels = ref<SupportChannel[] | null>(null)
const workspace = ref('canopy')
const origin = ref('')
const chatForm = reactive({ title: '', launcher: '' })

async function load() {
  const data = await fetchUntyped<{ channels: SupportChannel[], workspace: string }>('/api/service/channels')
  channels.value = data.channels
  workspace.value = data.workspace
  const chat = data.channels.find(c => c.id === 'web_chat')
  Object.assign(chatForm, { title: chat?.config?.title ?? '', launcher: chat?.config?.launcher ?? '' })
}
onMounted(() => {
  origin.value = window.location.origin
  load()
})

const webChat = computed(() => channels.value?.find(c => c.id === 'web_chat'))
const others = computed(() => (channels.value ?? []).filter(c => c.id !== 'web_chat'))
const portalUrl = computed(() => `${origin.value}/portal${workspace.value === 'canopy' ? '' : `/${workspace.value}`}`)
const snippet = computed(() => `<script src="${origin.value}/widget.js" data-workspace="${workspace.value}"${chatForm.launcher ? ` data-label="${chatForm.launcher.replace(/"/g, '&quot;')}"` : ''} async><\/script>`)

async function saveChat(patch: { enabled?: boolean } = {}) {
  try {
    channels.value = (await fetchUntyped<{ channels: SupportChannel[] }>('/api/service/channels/web_chat', { method: 'PATCH', body: { ...chatForm, ...patch } })).channels
    toast(patch.enabled === undefined ? 'Website chat saved' : patch.enabled ? 'Website chat switched on' : 'Website chat switched off')
  }
  catch (error: any) {
    toast.error('Not saved', { description: error?.data?.statusMessage })
  }
}
async function copy(text: string) {
  await navigator.clipboard.writeText(text)
  toast('Copied')
}

const STATE: Record<SupportChannel['state'], { label: string, class: string }> = {
  connected: { label: 'Connected', class: 'bg-brand-mist text-brand-forest dark:bg-brand-spruce dark:text-brand-mist' },
  off: { label: 'Off', class: 'bg-muted text-muted-foreground' },
  setup: { label: 'Needs setup', class: 'bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-100' },
  soon: { label: 'Coming soon', class: 'bg-muted text-muted-foreground' },
}
const ICONS: Record<string, string> = { web_chat: 'i-lucide-messages-square', portal: 'i-lucide-life-buoy', email: 'i-lucide-mail', api: 'i-lucide-code-xml', whatsapp: 'i-lucide-message-circle', telegram: 'i-lucide-send' }
const LINKS: Record<string, { label: string, to: string } | undefined> = { api: { label: 'API keys', to: '/admin/api-keys' } }
</script>

<template>
  <div class="flex w-full flex-col gap-4">
    <PageTitle title="Channels" description="Every way customers reach your support desk. Everything lands in Cases and Live chat, so the team works from one place." />

    <RecordCard v-if="webChat">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="flex items-start gap-3">
          <span class="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-mist text-brand-forest dark:bg-brand-spruce dark:text-brand-mist"><Icon :name="ICONS.web_chat!" class="size-5" /></span>
          <div>
            <h2 class="m-0 text-lg font-bold text-foreground">
              {{ webChat.name }}
            </h2>
            <p class="m-0 text-sm text-muted-foreground">
              {{ webChat.description }}
            </p>
            <p class="m-0 mt-1 text-sm">
              {{ webChat.detail }} · <NuxtLink to="/ai-agents" class="font-semibold underline">
                AI agents
              </NuxtLink>
            </p>
          </div>
        </div>
        <label class="flex items-center gap-2 text-sm font-semibold">
          <Switch :model-value="webChat.enabled" :disabled="!isAdmin" aria-label="Website chat on or off" @update:model-value="(value: boolean) => saveChat({ enabled: value })" />
          {{ webChat.enabled ? 'On' : 'Off' }}
        </label>
      </div>
      <div class="grid gap-4 lg:grid-cols-2">
        <fieldset class="m-0 flex flex-col gap-3 border-0 p-0" :disabled="!isAdmin">
          <div class="flex flex-col gap-1.5">
            <Label for="chat-title">Chat title</Label>
            <Input id="chat-title" v-model="chatForm.title" maxlength="60" placeholder="e.g. Acme support" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="chat-launcher">Button text</Label>
            <Input id="chat-launcher" v-model="chatForm.launcher" maxlength="30" placeholder="Chat with us" />
          </div>
          <Button v-if="isAdmin" class="self-start" @click="saveChat()">
            Save
          </Button>
        </fieldset>
        <div class="flex flex-col gap-2">
          <span class="text-sm font-semibold">Add it to your own website</span>
          <p class="m-0 text-xs text-muted-foreground">
            Paste this before <code>&lt;/body&gt;</code> on any page. Chats come into Live chat like the portal's.
          </p>
          <pre class="m-0 overflow-x-auto whitespace-pre-wrap break-all rounded-2xl bg-brand-obsidian p-4 font-mono text-xs text-brand-lime">{{ snippet }}</pre>
          <div class="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" @click="copy(snippet)">
              <Icon name="i-lucide-copy" />
              Copy code
            </Button>
            <Button size="sm" variant="ghost" as-child>
              <a :href="`/widget/${workspace}`" target="_blank" rel="noopener">
                <Icon name="i-lucide-external-link" />
                Try it
              </a>
            </Button>
          </div>
        </div>
      </div>
    </RecordCard>

    <div class="grid gap-4 md:grid-cols-2">
      <RecordCard v-for="channel in others" :key="channel.id">
        <div class="flex items-start gap-3">
          <span class="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-muted text-foreground"><Icon :name="ICONS[channel.id] ?? 'i-lucide-radio-tower'" class="size-5" /></span>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h2 class="m-0 text-lg font-bold text-foreground">
                {{ channel.name }}
              </h2>
              <span class="rounded-full px-2.5 py-0.5 text-xs font-bold" :class="STATE[channel.state].class">{{ STATE[channel.state].label }}</span>
            </div>
            <p class="m-0 text-sm text-muted-foreground">
              {{ channel.description }}
            </p>
            <p v-if="channel.detail" class="m-0 mt-1 text-sm">
              {{ channel.detail }}
            </p>
            <div class="mt-2 flex flex-wrap gap-2">
              <Button v-if="channel.id === 'portal'" size="sm" variant="outline" as-child>
                <a :href="portalUrl" target="_blank" rel="noopener">
                  <Icon name="i-lucide-external-link" />
                  Open portal
                </a>
              </Button>
              <Button v-if="channel.id === 'portal'" size="sm" variant="ghost" @click="copy(portalUrl)">
                <Icon name="i-lucide-copy" />
                Copy link
              </Button>
              <Button v-if="LINKS[channel.id]" size="sm" variant="outline" as-child>
                <NuxtLink :to="LINKS[channel.id]!.to">
                  {{ LINKS[channel.id]!.label }}
                </NuxtLink>
              </Button>
            </div>
          </div>
        </div>
      </RecordCard>
    </div>
  </div>
</template>
