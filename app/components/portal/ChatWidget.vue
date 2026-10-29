<script setup lang="ts">
import type { LiveChatMessage, VisitorChatView } from '~/types/liveChat'

/** "Chat with us" on the support portal. Talks to /api/public/chats with the visitor's private token. */
const props = defineProps<{
  workspace: string
  companyName: string
  /** Header title (Channels → Website chat); defaults to "<company> support". */
  title?: string
  /** Button text; defaults to "Chat with us". */
  launcher?: string
  /** Embedded on another website (/widget/<workspace>): opens straight away and has no launcher. */
  embedded?: boolean
}>()

const open = ref(!!props.embedded)
const token = ref<string | null>(null)
const status = ref<VisitorChatView['status'] | null>(null)
const agentName = ref<string>()
const aiAgentName = ref<string>()
const typing = ref(false)
const messages = ref<LiveChatMessage[]>([])
const form = reactive({ name: '', email: '', message: '' })
const draft = ref('')
const error = ref('')
const busy = ref(false)
const storageKey = computed(() => `canopy-chat-${props.workspace}`)

function remember(value: string | null) {
  try {
    if (value)
      sessionStorage.setItem(storageKey.value, value)
    else
      sessionStorage.removeItem(storageKey.value)
  }
  catch {
    // Private mode: the chat just won't survive a reload.
  }
}

const thread = ref<HTMLElement>()
async function poll() {
  if (!token.value)
    return
  try {
    const after = messages.value.at(-1)?.createdAt
    const view = await fetchUntyped<VisitorChatView>(`/api/public/chats/${token.value}`, { query: { workspace: props.workspace, after } })
    status.value = view.status
    agentName.value = view.agentName
    aiAgentName.value = view.aiAgentName
    typing.value = !!view.typing
    if (view.messages.length) {
      messages.value.push(...view.messages.filter(m => !messages.value.some(existing => existing.id === m.id)))
      nextTick(() => thread.value?.scrollTo({ top: thread.value.scrollHeight }))
    }
  }
  catch (e: any) {
    if (e?.statusCode === 404)
      reset()
  }
}

function reset() {
  token.value = null
  status.value = null
  messages.value = []
  remember(null)
}

let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  try {
    token.value = sessionStorage.getItem(storageKey.value)
  }
  catch {}
  if (token.value)
    poll()
  timer = setInterval(() => open.value && status.value !== 'closed' && poll(), 3000)
})
onBeforeUnmount(() => clearInterval(timer))

async function start() {
  error.value = ''
  busy.value = true
  try {
    const result = await fetchUntyped<{ token: string }>('/api/public/chats', { method: 'POST', query: { workspace: props.workspace }, body: form })
    token.value = result.token
    remember(result.token)
    form.message = ''
    await poll()
  }
  catch (e: any) {
    error.value = e?.data?.statusMessage ?? 'Could not start the chat. Please try again.'
  }
  finally {
    busy.value = false
  }
}

async function send() {
  const message = draft.value.trim()
  if (!message || !token.value)
    return
  draft.value = ''
  try {
    await $fetch(`/api/public/chats/${token.value}`, { method: 'POST', query: { workspace: props.workspace }, body: { message } })
    await poll()
  }
  catch (e: any) {
    error.value = e?.data?.statusMessage ?? 'Message not sent.'
    draft.value = message
  }
}

/** Leave the AI assistant and queue for a person. */
async function askForPerson() {
  if (!token.value)
    return
  await $fetch(`/api/public/chats/${token.value}`, { method: 'POST', query: { workspace: props.workspace }, body: { action: 'human' } }).catch(() => {})
  await poll()
}

const headerLine = computed(() => {
  if (status.value === 'ai')
    return `${aiAgentName.value ?? 'Our assistant'} · AI assistant`
  if (status.value === 'active' && agentName.value)
    return `You're chatting with ${agentName.value}`
  if (status.value === 'waiting')
    return 'Waiting for the next available person…'
  if (status.value === 'closed')
    return 'Chat ended'
  return 'We usually reply in a few minutes'
})

async function end() {
  if (!token.value)
    return
  await $fetch(`/api/public/chats/${token.value}`, { method: 'POST', query: { workspace: props.workspace }, body: { action: 'end' } }).catch(() => {})
  await poll()
}

const inputClass = 'min-h-11 w-full rounded-xl border border-[#868685] bg-white px-3.5 text-[15px] text-brand-obsidian outline-none focus-visible:ring-2 focus-visible:ring-brand-forest'
</script>

<template>
  <div :class="embedded ? 'flex h-dvh w-full flex-col' : 'fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6'">
    <section
      v-if="open"
      id="portal-chat"
      aria-label="Live chat"
      class="flex flex-col overflow-hidden bg-white"
      :class="embedded ? 'h-full w-full' : 'max-h-[min(640px,calc(100vh-7rem))] w-[min(380px,calc(100vw-2rem))] rounded-[28px] shadow-[0_10px_40px_rgba(0,0,0,0.2)] ring-1 ring-black/10'"
    >
      <header class="flex items-center justify-between gap-3 bg-brand-forest px-5 py-4 text-white">
        <div>
          <div class="font-bold">
            {{ title || `${companyName} support` }}
          </div>
          <div class="text-xs text-brand-mist">
            {{ headerLine }}
          </div>
        </div>
        <button v-if="!embedded" type="button" class="flex size-9 items-center justify-center rounded-full bg-brand-spruce" aria-label="Minimise chat" @click="open = false">
          <Icon name="i-lucide-minus" class="size-4" />
        </button>
      </header>

      <form v-if="!token" class="flex flex-col gap-3 p-5" novalidate @submit.prevent="start">
        <label class="flex flex-col gap-1 text-sm font-semibold text-brand-forest">Name
          <input v-model="form.name" type="text" autocomplete="name" :class="inputClass">
        </label>
        <label class="flex flex-col gap-1 text-sm font-semibold text-brand-forest">Email
          <input v-model="form.email" type="email" autocomplete="email" :class="inputClass">
        </label>
        <label class="flex flex-col gap-1 text-sm font-semibold text-brand-forest">How can we help?
          <textarea v-model="form.message" rows="3" :class="inputClass" class="py-2.5" />
        </label>
        <p v-if="error" class="m-0 text-sm font-semibold text-[#a11f26]" role="alert">
          {{ error }}
        </p>
        <button type="submit" :disabled="busy" class="min-h-12 rounded-full bg-brand-forest font-semibold text-brand-lime disabled:opacity-70">
          {{ busy ? 'Starting…' : 'Start chat' }}
        </button>
      </form>

      <template v-else>
        <div ref="thread" class="flex flex-1 flex-col gap-2.5 overflow-y-auto bg-[#f6f7f5] p-4" aria-live="polite">
          <template v-for="message in messages" :key="message.id">
            <p v-if="message.authorType === 'system'" class="m-0 self-center text-center text-xs text-[#5d605d]">
              {{ message.body }}
            </p>
            <div v-else class="flex max-w-[85%] flex-col gap-0.5" :class="message.authorType === 'visitor' ? 'self-end items-end' : 'self-start'">
              <span v-if="message.authorType === 'ai'" class="flex items-center gap-1 text-[11px] font-semibold text-[#5d605d]">
                <Icon name="i-lucide-sparkles" class="size-3" /> {{ message.authorName }} · AI
              </span>
              <p
                class="m-0 whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-[15px] leading-normal"
                :class="message.authorType === 'visitor' ? 'bg-brand-forest text-white' : message.authorType === 'ai' ? 'bg-brand-mist text-brand-obsidian' : 'bg-white text-brand-obsidian ring-1 ring-black/10'"
              >
                {{ message.body }}
              </p>
            </div>
          </template>
          <p v-if="typing" class="m-0 flex items-center gap-1 self-start rounded-2xl bg-brand-mist px-3.5 py-2.5" role="status" aria-label="The assistant is typing">
            <span v-for="dot in 3" :key="dot" class="size-1.5 animate-bounce rounded-full bg-brand-forest" :style="{ animationDelay: `${dot * 120}ms` }" />
          </p>
        </div>
        <form v-if="status !== 'closed'" class="flex gap-2 border-t border-brand-fog p-3" @submit.prevent="send">
          <label for="portal-chat-input" class="sr-only">Message</label>
          <input id="portal-chat-input" v-model="draft" type="text" placeholder="Type a message" :class="inputClass">
          <button type="submit" class="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-lime text-brand-forest" aria-label="Send">
            <Icon name="i-lucide-arrow-up" class="size-5" />
          </button>
        </form>
        <div class="flex justify-between gap-2 border-t border-brand-fog px-4 py-2 text-xs">
          <span v-if="status !== 'closed'" class="flex gap-3">
            <button v-if="status === 'ai'" type="button" class="font-semibold text-brand-forest underline" @click="askForPerson">
              Talk to a person
            </button>
            <button type="button" class="font-semibold text-brand-forest underline" @click="end">
              End chat
            </button>
          </span>
          <button v-else type="button" class="font-semibold text-brand-forest underline" @click="reset">
            Start a new chat
          </button>
          <span v-if="error" class="text-[#a11f26]">{{ error }}</span>
        </div>
      </template>
    </section>

    <button
      v-if="!embedded"
      type="button"
      class="inline-flex min-h-13 items-center gap-2 rounded-full bg-brand-forest px-5 font-semibold text-brand-lime shadow-[0_8px_24px_rgba(0,0,0,0.2)]"
      :aria-expanded="open"
      aria-controls="portal-chat"
      @click="open = !open; open && token && poll()"
    >
      <Icon name="i-lucide-messages-square" class="size-5" />
      {{ open ? 'Close chat' : (launcher || 'Chat with us') }}
    </button>
  </div>
</template>
