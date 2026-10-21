<script setup lang="ts">
import type { CareConversation } from '~/types/care'
import { toast } from 'vue-sonner'

// "Canopy Care — multi-client agent desktop" in the Canopy design.
definePageMeta({ middleware: 'care-agent' })

interface Playbook { id: string, orgId: string, orgName?: string, orgSlug?: string, greeting: string, slaText: string, dos: string, donts: string }
interface Transcript { kind: 'chat' | 'ticket', title: string, customer: string, status: string, messages: { id: string, author: string, fromCustomer: boolean, system: boolean, body: string, at: string }[] }

const conversations = ref<CareConversation[]>([])
const playbooks = ref<Playbook[]>([])
const stats = ref<{ handledToday: number, quality: number | null, evaluations: number, shift: string | null } | null>(null)
const error = ref('')
const active = ref<CareConversation | null>(null)
const transcript = ref<Transcript | null>(null)
const draft = ref('')

async function load() {
  try {
    const result = await fetchUntyped<{ engagements: Playbook[], conversations: CareConversation[], stats: NonNullable<typeof stats.value> }>('/api/care/desktop')
    conversations.value = result.conversations
    playbooks.value = result.engagements
    stats.value = result.stats
    error.value = ''
    if (active.value && !result.conversations.some(c => c.orgId === active.value!.orgId && c.id === active.value!.id && c.kind === active.value!.kind)) {
      // It was closed or picked up by the client's own team.
      active.value = null
      transcript.value = null
    }
  }
  catch (e: any) {
    error.value = e?.data?.statusMessage ?? 'Could not load conversations.'
  }
}

const thread = ref<HTMLElement>()
async function loadTranscript() {
  if (!active.value)
    return
  const next = await fetchUntyped<Transcript>(`/api/care/desktop/${active.value.orgId}/${active.value.kind}/${active.value.id}`).catch(() => null)
  const grew = (next?.messages.length ?? 0) !== (transcript.value?.messages.length ?? 0)
  transcript.value = next
  if (grew)
    nextTick(() => thread.value?.scrollTo({ top: thread.value.scrollHeight }))
}

function pick(conversation: CareConversation) {
  active.value = conversation
  transcript.value = null
  const playbook = playbooks.value.find(p => p.orgId === conversation.orgId)
  draft.value = conversation.kind === 'chat' && conversation.status === 'waiting' ? (playbook?.greeting ?? '') : ''
  loadTranscript()
}

let timer: ReturnType<typeof setInterval> | undefined
onMounted(async () => {
  await load()
  timer = setInterval(() => {
    load()
    loadTranscript()
  }, 4000)
})
onBeforeUnmount(() => clearInterval(timer))

const playbook = computed(() => playbooks.value.find(p => p.orgId === active.value?.orgId))
const CLIENT_TONES = ['bg-brand-forest text-white', 'bg-brand-lime text-brand-forest', 'bg-brand-spruce text-white', 'bg-brand-mist text-brand-forest']
const toneFor = (orgId: string) => CLIENT_TONES[Math.max(0, playbooks.value.findIndex(p => p.orgId === orgId)) % CLIENT_TONES.length]

const busy = ref(false)
async function act(action: 'reply' | 'create_case' | 'transfer') {
  if (!active.value)
    return
  busy.value = true
  try {
    const result = await fetchUntyped<{ ticketId?: string }>(`/api/care/desktop/${active.value.orgId}/${active.value.kind}/${active.value.id}`, { method: 'POST', body: { action, message: draft.value } })
    if (action === 'reply')
      draft.value = ''
    if (action === 'create_case')
      toast(`Case ${result.ticketId} opened in ${active.value.orgName}'s workspace`)
    if (action === 'transfer') {
      toast(`Handed to the ${active.value.orgName} team`)
      active.value = null
      transcript.value = null
    }
    await load()
    await loadTranscript()
  }
  catch (e: any) {
    toast.error('Not done', { description: e?.data?.statusMessage })
  }
  finally {
    busy.value = false
  }
}

const now = ref(Date.now())
let clock: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  clock = setInterval(() => now.value = Date.now(), 15000)
})
onBeforeUnmount(() => clearInterval(clock))
function waited(since: string) {
  const minutes = Math.round((now.value - new Date(since).getTime()) / 60000)
  return minutes < 60 ? `${minutes}m` : minutes < 2880 ? `${Math.floor(minutes / 60)}h` : `${Math.round(minutes / 1440)}d`
}
const time = (iso: string) => new Date(iso).toLocaleTimeString(APP_LOCALE, { hour: '2-digit', minute: '2-digit' })
</script>

<template>
  <div class="flex w-full flex-col gap-4">
    <CareNav />
    <p v-if="error" role="alert" class="rounded-2xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
      {{ error }}
    </p>

    <div class="flex flex-wrap items-start gap-4">
      <!-- Conversations -->
      <section aria-label="My conversations" class="flex max-h-[calc(100vh-10rem)] flex-[1_1_280px] flex-col gap-2 overflow-y-auto rounded-[28px] bg-card p-4 ring-1 ring-black/10 lg:max-w-[340px] dark:ring-white/10">
        <div class="flex items-center justify-between">
          <h2 class="m-0 text-base font-bold text-foreground">
            My conversations
          </h2>
          <span class="text-xs text-muted-foreground">Certified for {{ playbooks.length }} client{{ playbooks.length === 1 ? '' : 's' }}</span>
        </div>
        <button
          v-for="conversation in conversations"
          :key="`${conversation.orgId}-${conversation.kind}-${conversation.id}`"
          type="button"
          class="flex flex-col gap-1 rounded-2xl p-3 text-left"
          :class="active?.id === conversation.id && active.orgId === conversation.orgId ? 'bg-brand-mist ring-2 ring-brand-forest dark:bg-brand-spruce' : 'ring-1 ring-black/10 hover:bg-muted dark:ring-white/10'"
          :aria-pressed="active?.id === conversation.id && active.orgId === conversation.orgId"
          @click="pick(conversation)"
        >
          <span class="flex items-center gap-2 text-xs font-semibold">
            <span aria-hidden="true" class="size-2.5 rounded-full ring-1 ring-brand-forest" :class="toneFor(conversation.orgId)" />
            {{ conversation.orgName }} · {{ conversation.kind === 'chat' ? 'Web chat' : 'Email' }}
            <span class="ml-auto text-muted-foreground">{{ waited(conversation.waitingSince) }}</span>
          </span>
          <span class="font-semibold text-foreground">{{ conversation.customer }}</span>
          <span class="line-clamp-1 text-sm text-muted-foreground">{{ conversation.preview }}</span>
        </button>
        <p v-if="!conversations.length" class="m-0 p-3 text-center text-sm text-muted-foreground">
          {{ playbooks.length ? 'Nothing waiting for your clients.' : 'You aren\'t assigned to a live Care client yet.' }}
        </p>
      </section>

      <!-- Active conversation -->
      <section aria-label="Conversation" class="flex min-w-0 flex-[999_1_480px] flex-col gap-3.5">
        <template v-if="active && playbook">
          <div class="rounded-[28px] p-5" :class="toneFor(active.orgId)">
            <div class="text-[13px] font-semibold opacity-80">
              You are answering for
            </div>
            <div class="text-2xl font-black tracking-[-0.03em]">
              {{ active.orgName }}
            </div>
            <div class="mt-1 text-sm">
              SLA: {{ playbook.slaText }}
            </div>
            <div class="mt-1 text-sm italic">
              Greeting: "{{ playbook.greeting }}"
            </div>
          </div>

          <div class="flex flex-col gap-3 rounded-[28px] bg-card p-5 ring-1 ring-black/10 dark:ring-white/10">
            <div class="text-[13px] font-semibold text-muted-foreground">
              {{ active.kind === 'chat' ? 'Web chat' : 'Email' }} · {{ active.customer }} · {{ transcript?.title }}
            </div>
            <div ref="thread" class="flex max-h-[42vh] flex-col gap-2.5 overflow-y-auto" aria-live="polite">
              <template v-for="message in transcript?.messages ?? []" :key="message.id">
                <p v-if="message.system" class="m-0 self-center text-xs text-muted-foreground">
                  {{ message.body }}
                </p>
                <div v-else class="flex max-w-[85%] flex-col gap-0.5" :class="message.fromCustomer ? 'self-start' : 'self-end items-end'">
                  <span class="text-[11px] font-semibold text-muted-foreground">{{ message.author }} · {{ time(message.at) }}</span>
                  <p class="m-0 whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm" :class="message.fromCustomer ? 'bg-brand-fog text-brand-obsidian dark:bg-muted dark:text-foreground' : 'bg-brand-forest text-white'">
                    {{ message.body }}
                  </p>
                </div>
              </template>
              <p v-if="!transcript" class="m-0 text-sm text-muted-foreground">
                Loading…
              </p>
            </div>
            <form class="flex flex-col gap-2 border-t pt-3" @submit.prevent="act('reply')">
              <Label for="care-reply" class="text-[13px] font-semibold">Reply (sent as you · Canopy Care)</Label>
              <Textarea id="care-reply" v-model="draft" rows="3" />
              <div class="flex flex-wrap justify-between gap-2">
                <div class="flex flex-wrap gap-2">
                  <Button v-if="active.kind === 'chat'" type="button" variant="outline" :disabled="busy" @click="act('create_case')">
                    Create case in client workspace
                  </Button>
                  <Button type="button" variant="outline" :disabled="busy" @click="act('transfer')">
                    Warm transfer to client
                  </Button>
                </div>
                <Button type="submit" :disabled="busy || !draft.trim()">
                  Send
                </Button>
              </div>
            </form>
          </div>
        </template>
        <div v-else class="flex min-h-[40vh] items-center justify-center rounded-[28px] bg-card p-10 text-center text-muted-foreground ring-1 ring-black/10 dark:ring-white/10">
          Choose a conversation. Each one shows which client you're answering for.
        </div>
      </section>

      <!-- Playbook & shift -->
      <aside class="flex flex-[1_1_280px] flex-col gap-3.5 lg:max-w-[340px]">
        <RecordCard v-if="playbook" :title="`${playbook.orgName} playbook`">
          <p class="m-0 text-sm">
            <b>Always:</b> {{ playbook.dos || '—' }}
          </p>
          <p class="m-0 text-sm text-destructive">
            <b>Never:</b> {{ playbook.donts || '—' }}
          </p>
          <p class="m-0 text-xs text-muted-foreground">
            Their knowledge base is in their workspace — published articles also show on their portal at /portal/{{ playbook.orgSlug }}.
          </p>
        </RecordCard>
        <RecordCard title="My shift">
          <dl class="m-0 grid grid-cols-2 gap-2 text-sm">
            <div class="rounded-xl bg-muted/60 p-3">
              <dt class="text-xs text-muted-foreground">
                Handled today
              </dt><dd class="m-0 text-xl font-black">
                {{ stats?.handledToday ?? '—' }}
              </dd>
            </div>
            <div class="rounded-xl bg-muted/60 p-3">
              <dt class="text-xs text-muted-foreground">
                Quality (last {{ stats?.evaluations || 10 }})
              </dt><dd class="m-0 text-xl font-black">
                {{ stats?.quality !== null && stats?.quality !== undefined ? `${stats.quality}%` : '—' }}
              </dd>
            </div>
            <div class="col-span-2 rounded-xl bg-muted/60 p-3">
              <dt class="text-xs text-muted-foreground">
                Today's shift
              </dt><dd class="m-0 text-xl font-black">
                {{ stats?.shift ?? 'Not on the rota' }}
              </dd>
            </div>
          </dl>
        </RecordCard>
      </aside>
    </div>
  </div>
</template>
