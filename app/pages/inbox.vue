<script setup lang="ts">
import type { AiAgentRun } from '~/types/aiAgent'
import type { KbArticle } from '~/types/knowledge'
import type { LiveChatDetail, LiveChatQueueStats, LiveChatSummary } from '~/types/liveChat'
import { toast } from 'vue-sonner'
import { tagChipClass } from '~/lib/tagColors'
import { AI_OUTCOME_LABELS } from '~/types/aiAgent'

// Live chat inbox ("Omnichannel — live chat" in the Canopy design). Customers start chats from the
// support portal; this page polls for new ones and new messages. With an AI agent switched on, new
// chats start in "AI handling": the team can watch, take over, or pass a chat back to the AI.
definePageMeta({ middleware: 'agent' })

const route = useRoute()
const { currentUser, currentOrg } = useAuth()
const { macros, fetchMacros } = useMacros()
const { staff, fetchStaff } = useStaff()

type ListFilter = 'open' | 'ai' | 'mine' | 'closed'
const filter = ref<ListFilter>('open')
const openChats = ref<LiveChatSummary[]>([])
const closedChats = ref<LiveChatSummary[]>([])
const stats = ref<LiveChatQueueStats | null>(null)

const selectedId = ref<string | null>(typeof route.query.open === 'string' ? route.query.open : null)
const chat = ref<LiveChatDetail | null>(null)
const articles = ref<KbArticle[]>([])
const aiRuns = ref<AiAgentRun[]>([])
interface ChatTag { id: string, name: string, color: string }
const chatTagList = ref<ChatTag[]>([])
const { tags: allTags, fetchTags, createTag } = useTags()
const draft = ref('')
const suggestion = ref('')

async function loadList() {
  const result = await fetchUntyped<{ chats: LiveChatSummary[], stats: LiveChatQueueStats }>('/api/chats')
  openChats.value = result.chats
  stats.value = result.stats
  if (filter.value === 'closed')
    closedChats.value = (await fetchUntyped<{ chats: LiveChatSummary[] }>('/api/chats', { query: { status: 'closed' } })).chats
}

async function loadChat() {
  if (!selectedId.value)
    return
  try {
    const result = await fetchUntyped<{ chat: LiveChatDetail, articles: KbArticle[], aiRuns: AiAgentRun[], tags: ChatTag[] }>(`/api/chats/${selectedId.value}`)
    const grew = (result.chat.messages.length ?? 0) > (chat.value?.id === result.chat.id ? chat.value.messages.length : 0)
    chat.value = result.chat
    articles.value = result.articles
    aiRuns.value = result.aiRuns
    chatTagList.value = result.tags
    if (grew)
      scrollThread()
  }
  catch (error: any) {
    if (error?.statusCode === 404) {
      selectedId.value = null
      chat.value = null
    }
  }
}

const listShown = computed(() => {
  if (filter.value === 'closed')
    return closedChats.value
  if (filter.value === 'mine')
    return openChats.value.filter(c => c.assigneeId === currentUser.value?.id)
  if (filter.value === 'ai')
    return openChats.value.filter(c => c.status === 'ai')
  return openChats.value.filter(c => c.status !== 'ai')
})
const listTabs = computed(() => [
  { value: 'open' as const, label: 'Needs a person', count: openChats.value.filter(c => c.status !== 'ai').length },
  { value: 'ai' as const, label: 'AI handling', count: openChats.value.filter(c => c.status === 'ai').length },
  { value: 'mine' as const, label: 'Mine', count: openChats.value.filter(c => c.assigneeId === currentUser.value?.id).length },
  { value: 'closed' as const, label: 'Closed' },
])
watch(filter, loadList)

function select(id: string) {
  selectedId.value = id
  chat.value = null
  draft.value = ''
  suggestion.value = ''
  aiRuns.value = []
  chatTagList.value = []
  navigateTo({ query: { ...route.query, open: id } }, { replace: true })
  loadChat()
}

let listTimer: ReturnType<typeof setInterval> | undefined
let chatTimer: ReturnType<typeof setInterval> | undefined
onMounted(async () => {
  await loadList()
  await loadChat()
  await fetchMacros()
  await fetchStaff()
  await fetchTags()
  listTimer = setInterval(() => loadList().catch(() => {}), 5000)
  chatTimer = setInterval(() => loadChat().catch(() => {}), 3000)
})
onBeforeUnmount(() => {
  clearInterval(listTimer)
  clearInterval(chatTimer)
})

const thread = ref<HTMLElement>()
function scrollThread() {
  nextTick(() => thread.value?.scrollTo({ top: thread.value.scrollHeight }))
}

// ── Composer ──────────────────────────────────────────────────────────────
const sending = ref(false)
/** Reply to the customer, or leave an internal note only the team sees. */
const composeMode = ref<'reply' | 'note'>('reply')
const slashQuery = computed(() => draft.value.match(/^\/(\S*)$/)?.[1]?.toLowerCase() ?? null)
const slashMatches = computed(() => slashQuery.value === null ? [] : macros.value.filter(m => m.name.toLowerCase().includes(slashQuery.value!)).slice(0, 6))

function useMacro(body: string) {
  draft.value = body
}

async function send() {
  const message = draft.value.trim()
  if (!message || !chat.value || sending.value)
    return
  sending.value = true
  try {
    chat.value = (await fetchUntyped<{ chat: LiveChatDetail }>(`/api/chats/${chat.value.id}/messages`, { method: 'POST', body: { message, note: composeMode.value === 'note' } })).chat
    draft.value = ''
    suggestion.value = ''
    scrollThread()
    loadList()
  }
  catch (error: any) {
    toast.error('Message not sent', { description: error?.data?.statusMessage })
  }
  finally {
    sending.value = false
  }
}

function onComposerKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    if (slashMatches.value.length)
      useMacro(slashMatches.value[0]!.body)
    else
      send()
  }
}

const suggesting = ref(false)
async function suggestReply() {
  if (!chat.value)
    return
  suggesting.value = true
  try {
    suggestion.value = (await fetchUntyped<{ suggestion: string }>(`/api/chats/${chat.value.id}/suggest`, { method: 'POST' })).suggestion
  }
  catch (error: any) {
    toast.error('No suggestion', { description: error?.data?.statusMessage })
  }
  finally {
    suggesting.value = false
  }
}

async function act(action: 'assign_me' | 'close' | 'create_ticket' | 'transfer' | 'return_to_ai', extra: Record<string, string> = {}) {
  if (!chat.value)
    return
  try {
    chat.value = (await fetchUntyped<{ chat: LiveChatDetail }>(`/api/chats/${chat.value.id}`, { method: 'PATCH', body: { action, ...extra } })).chat
    if (action === 'create_ticket')
      toast(`Ticket ${chat.value.ticketId} created`, { description: 'The transcript is on the ticket, and the customer was told.' })
    if (action === 'return_to_ai')
      toast(`${chat.value.aiAgentName ?? 'The AI'} is handling this chat again`)
    loadList()
  }
  catch (error: any) {
    toast.error('Could not do that', { description: error?.data?.statusMessage })
  }
}

// ── Tags (shared with cases; managed in Support setup → Tags) ──────────────
const tagQuery = ref('')
const tagOptions = computed(() => allTags.value.filter(t => !chatTagList.value.some(c => c.id === t.id) && t.name.toLowerCase().includes(tagQuery.value.trim().toLowerCase())).slice(0, 8))
async function saveTags(next: ChatTag[]) {
  if (!chat.value)
    return
  try {
    chatTagList.value = (await fetchUntyped<{ tags: ChatTag[] }>(`/api/chats/${chat.value.id}/tags`, { method: 'PUT', body: { tagIds: next.map(t => t.id) } })).tags
  }
  catch (error: any) {
    toast.error('Tags not saved', { description: error?.data?.statusMessage })
  }
}
async function addTag(tag?: ChatTag) {
  const picked = tag ?? (tagQuery.value.trim() ? await createTag(tagQuery.value.trim(), 'green') : null)
  tagQuery.value = ''
  if (picked)
    await saveTags([...chatTagList.value, picked])
}

const transferTargets = computed(() => staff.value.filter(s => s.status === 'active' && s.id !== currentUser.value?.id && s.roles.some(r => ['admin', 'agent', 'engineer', 'engineering_coordinator', 'engineering_lead'].includes(r))))

function insertArticle(article: KbArticle, mode: 'link' | 'answer') {
  const text = mode === 'link'
    ? `This article should help: ${article.title} ${window.location.origin}/kb/${currentOrg.value?.slug ?? 'canopy'}/${article.id}`
    : markdownToText(article.body)
  draft.value = draft.value.trim() ? `${draft.value.trim()}\n\n${text}` : text
}

// ── Formatting ────────────────────────────────────────────────────────────
const now = ref(Date.now())
let clock: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  clock = setInterval(() => now.value = Date.now(), 15000)
})
onBeforeUnmount(() => clearInterval(clock))

function waitLabel(since: string) {
  const seconds = Math.max(0, Math.round((now.value - new Date(since).getTime()) / 1000))
  return seconds < 60 ? `${seconds}s` : seconds < 3600 ? `${Math.floor(seconds / 60)}m` : `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
}
const time = (iso: string) => new Date(iso).toLocaleTimeString(APP_LOCALE, { hour: '2-digit', minute: '2-digit' })
const initials = (name: string) => name.split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase()
</script>

<template>
  <div class="flex w-full flex-col gap-4">
    <PageTitle title="Live chat" description="Chats customers start from your support portal. AI agents answer first when switched on; turn any chat into a ticket to keep its SLA and email follow-ups.">
      <template #aside>
        <PageSegmentedTabs v-model="filter" label="Chats" :options="listTabs" />
      </template>
    </PageTitle>

    <div class="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_320px]">
      <!-- Conversations -->
      <section aria-label="Conversations" class="flex max-h-[70vh] flex-col gap-2 overflow-y-auto rounded-[28px] bg-card p-3 ring-1 ring-black/10 dark:ring-white/10">
        <button
          v-for="item in listShown"
          :key="item.id"
          type="button"
          class="flex flex-col gap-1 rounded-2xl p-3 text-left transition-colors"
          :class="item.id === selectedId ? 'bg-brand-mist ring-2 ring-brand-forest dark:bg-brand-spruce' : 'hover:bg-muted'"
          :aria-pressed="item.id === selectedId"
          @click="select(item.id)"
        >
          <span class="flex items-center justify-between gap-2">
            <span class="truncate font-semibold text-foreground">{{ item.visitorName }}</span>
            <span v-if="item.status === 'waiting'" class="shrink-0 rounded-full bg-brand-lime px-2 py-0.5 text-[11px] font-bold text-brand-forest">{{ item.handedOffAt ? 'From AI' : 'Waiting' }} {{ waitLabel(item.handedOffAt ?? item.startedAt) }}</span>
            <span v-else-if="item.status === 'ai'" class="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-mist px-2 py-0.5 text-[11px] font-bold text-brand-forest dark:bg-brand-spruce dark:text-brand-mist"><Icon name="i-lucide-sparkles" class="size-3" />AI</span>
            <span v-else class="shrink-0 text-xs text-muted-foreground">{{ time(item.lastMessageAt) }}</span>
          </span>
          <span class="truncate text-xs text-muted-foreground">{{ item.clientName ?? item.visitorEmail }}<template v-if="item.assigneeName"> · {{ item.assigneeName }}</template></span>
          <span class="line-clamp-1 text-sm">{{ item.lastMessage }}</span>
        </button>
        <p v-if="!listShown.length" class="m-0 p-4 text-center text-sm text-muted-foreground">
          {{ filter === 'closed' ? 'No ended chats yet.' : filter === 'ai' ? 'The AI isn\'t handling any chats right now.' : 'No one is waiting. Chats start from the "Chat with us" button on your support portal.' }}
        </p>
      </section>

      <!-- Thread -->
      <section aria-label="Conversation" class="flex min-h-[60vh] min-w-0 flex-col rounded-[28px] bg-card ring-1 ring-black/10 dark:ring-white/10">
        <template v-if="chat">
          <header class="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
            <div class="flex min-w-0 items-center gap-3">
              <span aria-hidden="true" class="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-forest text-sm font-bold text-brand-lime">{{ initials(chat.visitorName) }}</span>
              <div class="min-w-0">
                <div class="truncate font-semibold text-foreground">
                  Web chat · {{ chat.visitorName }}
                </div>
                <div class="truncate text-xs text-muted-foreground">
                  {{ chat.visitorEmail }} · started {{ time(chat.startedAt) }}<template v-if="chat.status === 'ai'">
                    · {{ chat.aiAgentName ?? 'AI agent' }} (AI) is answering
                  </template><template v-else-if="chat.assigneeName">
                    · with {{ chat.assigneeName }}
                  </template>
                </div>
              </div>
            </div>
            <div class="flex flex-wrap gap-1.5">
              <Button v-if="chat.status !== 'closed' && (chat.status === 'ai' || chat.assigneeId !== currentUser?.id)" size="sm" variant="lime" @click="act('assign_me')">
                <Icon :name="chat.status === 'ai' ? 'i-lucide-hand' : 'i-lucide-user-check'" />
                {{ chat.status === 'ai' ? 'Take over' : 'Take chat' }}
              </Button>
              <Button v-if="chat.status === 'active' || chat.status === 'waiting'" size="sm" variant="outline" @click="act('return_to_ai')">
                <Icon name="i-lucide-sparkles" />
                Back to AI
              </Button>
              <Button v-if="chat.ticketId" size="sm" variant="outline" as-child>
                <NuxtLink :to="`/tickets?open=${chat.ticketId}`">
                  {{ chat.ticketId }}
                </NuxtLink>
              </Button>
              <Button v-else size="sm" variant="outline" @click="act('create_ticket')">
                Create ticket
              </Button>
              <DropdownMenu v-if="chat.status !== 'closed' && transferTargets.length">
                <DropdownMenuTrigger as-child>
                  <Button size="sm" variant="outline">
                    Transfer
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem v-for="member in transferTargets" :key="member.id" @select="act('transfer', { assigneeId: member.id })">
                    {{ member.name }}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button v-if="chat.status !== 'closed'" size="sm" variant="destructive" @click="act('close')">
                End chat
              </Button>
            </div>
          </header>

          <div ref="thread" class="flex max-h-[52vh] flex-1 flex-col gap-3 overflow-y-auto px-5 py-4" aria-live="polite">
            <template v-for="message in chat.messages" :key="message.id">
              <p v-if="message.authorType === 'system'" class="m-0 self-center rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                {{ message.body }}
              </p>
              <div v-else-if="message.authorType === 'note'" class="flex w-full max-w-[90%] flex-col gap-1 self-center rounded-2xl border border-dashed border-amber-400 bg-amber-50 px-4 py-2.5 text-sm text-amber-950 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-100">
                <span class="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide"><Icon name="i-lucide-lock" class="size-3" />Internal note · {{ message.authorName }} · {{ time(message.createdAt) }}</span>
                <span class="whitespace-pre-wrap">{{ message.body }}</span>
              </div>
              <div v-else class="flex max-w-[80%] flex-col gap-1" :class="message.authorType === 'visitor' ? 'self-start' : 'self-end items-end'">
                <span class="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                  <Icon v-if="message.authorType === 'ai'" name="i-lucide-sparkles" class="size-3" />
                  {{ message.authorType === 'visitor' ? 'Customer' : message.authorType === 'ai' ? `${message.authorName} · AI` : message.authorName }} · {{ time(message.createdAt) }}
                </span>
                <p
                  class="m-0 whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-normal"
                  :class="message.authorType === 'agent' ? 'bg-brand-forest text-white' : message.authorType === 'ai' ? 'bg-brand-mist text-brand-obsidian ring-1 ring-brand-forest/20 dark:bg-brand-spruce dark:text-white' : 'bg-brand-fog text-brand-obsidian dark:bg-muted dark:text-foreground'"
                >
                  {{ message.body }}
                </p>
              </div>
            </template>
          </div>

          <form v-if="chat.status !== 'closed'" class="flex flex-col gap-2 border-t p-4" @submit.prevent="send">
            <div v-if="suggestion" class="flex flex-col gap-2 rounded-2xl bg-brand-mist p-3 text-sm text-brand-forest dark:bg-brand-spruce dark:text-brand-mist">
              <span class="text-xs font-bold uppercase tracking-wide">Suggested reply</span>
              {{ suggestion }}
              <div class="flex gap-2">
                <Button type="button" size="sm" variant="lime" @click="draft = suggestion; suggestion = ''">
                  Use it
                </Button>
                <Button type="button" size="sm" variant="ghost" @click="suggestion = ''">
                  Dismiss
                </Button>
              </div>
            </div>
            <ul v-if="slashMatches.length" class="m-0 flex list-none flex-col gap-1 rounded-2xl bg-muted p-2" role="listbox" aria-label="Macros">
              <li v-for="macro in slashMatches" :key="macro.id">
                <button type="button" class="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-background" @click="useMacro(macro.body)">
                  <span class="font-semibold">/{{ macro.name }}</span> <span class="text-muted-foreground">{{ macro.body.slice(0, 80) }}</span>
                </button>
              </li>
            </ul>
            <div class="flex items-center justify-between gap-2">
              <div class="inline-flex rounded-full bg-muted p-0.5 text-xs font-semibold" role="radiogroup" aria-label="Message type">
                <button type="button" role="radio" :aria-checked="composeMode === 'reply'" class="rounded-full px-3 py-1.5" :class="composeMode === 'reply' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'" @click="composeMode = 'reply'">
                  Reply
                </button>
                <button type="button" role="radio" :aria-checked="composeMode === 'note'" class="rounded-full px-3 py-1.5" :class="composeMode === 'note' ? 'bg-amber-100 text-amber-950 shadow-sm dark:bg-amber-500/20 dark:text-amber-100' : 'text-muted-foreground'" @click="composeMode = 'note'">
                  Internal note
                </button>
              </div>
              <span v-if="chat.status === 'ai' && composeMode === 'reply'" class="text-xs text-muted-foreground">Replying takes the chat over from the AI.</span>
            </div>
            <label for="chat-reply" class="sr-only">{{ composeMode === 'note' ? 'Internal note' : 'Reply' }}</label>
            <textarea
              id="chat-reply"
              v-model="draft"
              rows="3"
              class="w-full resize-none rounded-2xl border px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              :class="composeMode === 'note' ? 'border-amber-400 bg-amber-50 dark:bg-amber-500/10' : 'border-input bg-background'"
              :placeholder="composeMode === 'note' ? 'Note for the team — the customer won\'t see this' : 'Type a reply — Enter to send, Shift+Enter for a new line, / for macros'"
              @keydown="onComposerKeydown"
            />
            <div class="flex flex-wrap justify-between gap-2">
              <Button type="button" variant="ghost" size="sm" :disabled="suggesting" @click="suggestReply">
                <Icon name="i-lucide-sparkles" />
                {{ suggesting ? 'Thinking…' : 'Suggest reply' }}
              </Button>
              <Button type="submit" :disabled="sending || !draft.trim()">
                {{ composeMode === 'note' ? 'Add note' : 'Send' }}
              </Button>
            </div>
          </form>
          <p v-else class="m-0 border-t p-4 text-center text-sm text-muted-foreground">
            This chat ended{{ chat.closedAt ? ` at ${time(chat.closedAt)}` : '' }}.
          </p>
        </template>
        <div v-else class="flex flex-1 items-center justify-center p-10 text-center text-muted-foreground">
          {{ selectedId ? 'Loading…' : 'Choose a conversation.' }}
        </div>
      </section>

      <!-- Context -->
      <aside class="flex flex-col gap-3.5 lg:col-span-2 xl:col-span-1">
        <section v-if="chat" class="flex flex-col gap-2 rounded-[28px] bg-card p-5 ring-1 ring-black/10 dark:ring-white/10">
          <h2 class="m-0 text-base font-bold text-foreground">
            Customer
          </h2>
          <template v-if="chat.identified">
            <div class="font-semibold text-foreground">
              {{ chat.identified.contactName ?? chat.visitorName }}<template v-if="chat.identified.contactTitle">
                · {{ chat.identified.contactTitle }}
              </template>
            </div>
            <div class="text-sm text-muted-foreground">
              {{ chat.identified.clientName }} · {{ chat.identified.stage }}
            </div>
            <div class="text-xs text-muted-foreground">
              Matched by email: {{ chat.visitorEmail }}
            </div>
            <NuxtLink :to="`/clients?open=${chat.identified.clientId}`" class="text-sm font-semibold text-primary underline-offset-2 hover:underline dark:text-brand-lime">
              Open client
            </NuxtLink>
          </template>
          <p v-else class="m-0 text-sm text-muted-foreground">
            {{ chat.visitorEmail }} doesn't match a client or contact yet.
          </p>
          <NuxtLink :to="`/service/customers/${encodeURIComponent(chat.visitorEmail.toLowerCase())}`" class="text-sm font-semibold text-primary underline-offset-2 hover:underline dark:text-brand-lime">
            Customer history
          </NuxtLink>
          <div class="mt-1 flex flex-col gap-1.5 border-t pt-3">
            <span class="text-xs font-semibold text-muted-foreground">Tags</span>
            <div class="flex flex-wrap gap-1.5">
              <span v-for="tag in chatTagList" :key="tag.id" class="inline-flex items-center gap-1 rounded-full py-0.5 pl-2.5 pr-1 text-xs font-semibold" :class="tagChipClass(tag.color)">
                {{ tag.name }}
                <button type="button" class="rounded-full p-0.5 hover:bg-black/10" :aria-label="`Remove tag ${tag.name}`" @click="saveTags(chatTagList.filter(t => t.id !== tag.id))">
                  <Icon name="i-lucide-x" class="size-3" />
                </button>
              </span>
              <span v-if="!chatTagList.length" class="text-xs text-muted-foreground">None yet</span>
            </div>
            <form class="relative" @submit.prevent="addTag(tagOptions[0])">
              <label for="chat-tag" class="sr-only">Add a tag</label>
              <Input id="chat-tag" v-model="tagQuery" placeholder="Add a tag…" autocomplete="off" class="h-8 text-sm" />
              <ul v-if="tagQuery.trim()" class="absolute inset-x-0 top-full z-10 m-0 mt-1 flex list-none flex-col gap-0.5 rounded-xl bg-popover p-1 shadow-lg ring-1 ring-black/10 dark:ring-white/10" role="listbox" aria-label="Tags">
                <li v-for="tag in tagOptions" :key="tag.id">
                  <button type="button" class="w-full rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-muted" @click="addTag(tag)">
                    {{ tag.name }}
                  </button>
                </li>
                <li v-if="!allTags.some(t => t.name.toLowerCase() === tagQuery.trim().toLowerCase())">
                  <button type="button" class="w-full rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-muted" @click="addTag()">
                    Create “{{ tagQuery.trim() }}”
                  </button>
                </li>
              </ul>
            </form>
          </div>
        </section>

        <section v-if="chat && (chat.aiAgentId || aiRuns.length)" class="flex flex-col gap-2.5 rounded-[28px] bg-card p-5 ring-1 ring-black/10 dark:ring-white/10" aria-label="AI activity">
          <div class="flex items-center justify-between gap-2">
            <h2 class="m-0 flex items-center gap-1.5 text-base font-bold text-foreground">
              <Icon name="i-lucide-sparkles" class="size-4" />AI activity
            </h2>
            <NuxtLink v-if="chat.aiAgentId" :to="`/ai-agents/${chat.aiAgentId}`" class="text-xs font-semibold text-primary hover:underline dark:text-brand-lime">
              {{ chat.aiAgentName ?? 'Agent' }}
            </NuxtLink>
          </div>
          <p v-if="chat.handoffReason" class="m-0 rounded-xl bg-brand-mist px-3 py-2 text-sm text-brand-forest dark:bg-brand-spruce dark:text-brand-mist">
            Handed to the team: {{ chat.handoffReason }}
          </p>
          <details v-for="run in aiRuns" :key="run.id" class="rounded-xl bg-muted/60 px-3 py-2 text-sm">
            <summary class="cursor-pointer list-none">
              <span class="flex items-center justify-between gap-2">
                <span class="font-semibold text-foreground">{{ AI_OUTCOME_LABELS[run.outcome] }}</span>
                <span class="text-xs text-muted-foreground">{{ time(run.createdAt) }} · {{ (run.latencyMs / 1000).toFixed(1) }}s</span>
              </span>
              <span class="line-clamp-1 text-xs text-muted-foreground">“{{ run.question }}”</span>
            </summary>
            <div class="mt-2 flex flex-col gap-1.5 text-xs">
              <div v-if="run.sources.length">
                <span class="font-semibold">Sources:</span>
                <NuxtLink v-for="source in run.sources" :key="source.id" :to="`/knowledge/${source.id}`" class="ml-1 underline">
                  {{ source.title }}
                </NuxtLink>
              </div>
              <div v-for="(step, index) in run.steps" :key="index">
                <span class="font-mono">{{ step.tool }}</span> → {{ step.result }}
              </div>
              <div v-if="run.handoffReason">
                <span class="font-semibold">Handoff:</span> {{ run.handoffReason }}
              </div>
              <div v-if="run.error" class="text-destructive">
                {{ run.error }}
              </div>
            </div>
          </details>
          <p v-if="!aiRuns.length" class="m-0 text-sm text-muted-foreground">
            {{ chat.status === 'ai' ? 'The AI is reading the conversation…' : 'No AI replies in this chat.' }}
          </p>
        </section>

        <section v-if="chat" class="dark flex flex-col gap-2.5 rounded-[28px] bg-brand-forest p-5 text-white">
          <span class="self-start rounded-full bg-brand-lime px-3 py-1 text-xs font-bold text-brand-forest">Assist</span>
          <p v-if="!articles.length" class="m-0 text-sm text-brand-mist">
            No published article matches this conversation.
          </p>
          <div v-for="article in articles" :key="article.id" class="rounded-xl bg-brand-spruce p-3 text-sm">
            <div class="font-semibold">
              {{ article.title }}
            </div>
            <div class="mt-2 flex flex-wrap gap-1.5">
              <Button v-if="chat.status !== 'closed'" size="sm" variant="lime" @click="insertArticle(article, 'answer')">
                Use answer
              </Button>
              <Button v-if="chat.status !== 'closed' && article.visibility === 'public'" size="sm" variant="outline" class="border-brand-mist bg-transparent text-white hover:bg-white/10" @click="insertArticle(article, 'link')">
                Send link
              </Button>
            </div>
          </div>
        </section>

        <section class="flex flex-col gap-2 rounded-[28px] bg-card p-5 ring-1 ring-black/10 dark:ring-white/10">
          <h2 class="m-0 text-base font-bold text-foreground">
            Queue now
          </h2>
          <dl class="m-0 grid grid-cols-2 gap-2 text-sm">
            <div class="rounded-xl bg-muted/60 p-3">
              <dt class="text-xs text-muted-foreground">
                Waiting
              </dt>
              <dd class="m-0 text-2xl font-black text-foreground">
                {{ stats?.waiting ?? '—' }}
              </dd>
            </div>
            <div class="rounded-xl bg-muted/60 p-3">
              <dt class="text-xs text-muted-foreground">
                Longest wait
              </dt>
              <dd class="m-0 text-2xl font-black text-foreground">
                {{ stats?.waiting ? waitLabel(new Date(now - stats.longestWaitSeconds * 1000).toISOString()) : '—' }}
              </dd>
            </div>
            <div class="rounded-xl bg-muted/60 p-3">
              <dt class="text-xs text-muted-foreground">
                In conversation
              </dt>
              <dd class="m-0 text-2xl font-black text-foreground">
                {{ stats?.activeChats ?? '—' }}
              </dd>
            </div>
            <div class="rounded-xl bg-muted/60 p-3">
              <dt class="text-xs text-muted-foreground">
                AI handling
              </dt>
              <dd class="m-0 text-2xl font-black text-foreground">
                {{ stats?.aiHandling ?? '—' }}
              </dd>
            </div>
            <div class="rounded-xl bg-muted/60 p-3">
              <dt class="text-xs text-muted-foreground">
                Agents online
              </dt>
              <dd class="m-0 text-2xl font-black text-foreground">
                {{ stats ? `${stats.agentsOnline} of ${stats.agentsTotal}` : '—' }}
              </dd>
            </div>
          </dl>
        </section>
      </aside>
    </div>
  </div>
</template>
