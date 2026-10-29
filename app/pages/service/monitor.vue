<script setup lang="ts">
import type { MonitorChat, MonitorStats } from '~/types/supportDesk'
import { toast } from 'vue-sonner'
import { tagChipClass } from '~/lib/tagColors'

// Support desk → Conversation monitor: a supervisor's live wall of every open chat — what the AI is
// handling, who's waiting for a person and for how long, and who is talking to whom. Refreshes itself.
definePageMeta({ middleware: 'agent' })

const chats = ref<MonitorChat[] | null>(null)
const stats = ref<MonitorStats | null>(null)
const updatedAt = ref<number | null>(null)

async function load() {
  const data = await fetchUntyped<{ chats: MonitorChat[], stats: MonitorStats }>('/api/service/monitor')
  chats.value = data.chats
  stats.value = data.stats
  updatedAt.value = Date.now()
}

const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined
let clock: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  load()
  timer = setInterval(() => load().catch(() => {}), 5000)
  clock = setInterval(() => now.value = Date.now(), 1000)
})
onBeforeUnmount(() => {
  clearInterval(timer)
  clearInterval(clock)
})

const COLUMNS = [
  { status: 'waiting', title: 'Waiting for a person', empty: 'No one is waiting.', icon: 'i-lucide-hourglass' },
  { status: 'ai', title: 'AI handling', empty: 'The AI isn\'t handling any chats.', icon: 'i-lucide-sparkles' },
  { status: 'active', title: 'With an agent', empty: 'No chats with the team right now.', icon: 'i-lucide-headset' },
] as const
const inColumn = (status: string) => (chats.value ?? []).filter(c => c.status === status)

function seconds(since: string) {
  return Math.max(0, Math.round((now.value - new Date(since).getTime()) / 1000))
}
function duration(since: string) {
  const s = seconds(since)
  return s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
}
/** Waiting over 2 minutes is late, over 5 is urgent. */
const waitTone = (chat: MonitorChat) => !chat.waitingSince ? '' : seconds(chat.waitingSince) > 300 ? 'ring-2 ring-destructive' : seconds(chat.waitingSince) > 120 ? 'ring-2 ring-amber-400' : ''
const who = (authorType: string, authorName: string) => authorType === 'visitor' ? 'Customer' : authorType === 'ai' ? `${authorName} (AI)` : authorType === 'system' ? 'System' : authorName

async function takeOver(chat: MonitorChat) {
  try {
    await fetchUntyped(`/api/chats/${chat.id}`, { method: 'PATCH', body: { action: 'assign_me' } })
    await navigateTo(`/inbox?open=${chat.id}`)
  }
  catch (error: any) {
    toast.error('Could not take the chat', { description: error?.data?.statusMessage })
  }
}
</script>

<template>
  <div class="flex w-full flex-col gap-4">
    <PageActions label="Monitor actions">
      <Button variant="ghost" @click="load">
        <Icon name="i-lucide-refresh-cw" />
        Refresh
      </Button>
      <Button variant="ghost" as-child>
        <NuxtLink to="/inbox">
          <Icon name="i-lucide-messages-square" />
          Open live chat
        </NuxtLink>
      </Button>
    </PageActions>

    <PageTitle title="Conversation monitor" :description="`Every open chat, live. Updates every 5 seconds${updatedAt ? ` · last ${duration(new Date(updatedAt).toISOString())} ago` : ''}.`" />

    <div class="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
      <div
        v-for="tile in [
          { label: 'Started today', value: stats?.startedToday },
          { label: 'AI took', value: stats?.aiHandledToday },
          { label: 'Handed to the team', value: stats?.handedOffToday },
          { label: 'Closed today', value: stats?.closedToday },
          { label: 'Avg first reply', value: stats?.avgFirstResponseSeconds === undefined ? '—' : stats.avgFirstResponseSeconds < 60 ? `${stats.avgFirstResponseSeconds}s` : `${Math.round(stats.avgFirstResponseSeconds / 60)}m` },
          { label: 'Agents online', value: stats?.agentsOnline },
        ]" :key="tile.label" class="rounded-[24px] bg-card p-4 ring-1 ring-black/10 dark:ring-white/10"
      >
        <div class="text-xs text-muted-foreground">
          {{ tile.label }}
        </div>
        <div class="mt-1 text-3xl font-black tracking-[-0.04em] text-foreground">
          {{ tile.value ?? '—' }}
        </div>
      </div>
    </div>

    <div class="grid items-start gap-4 lg:grid-cols-3">
      <section v-for="column in COLUMNS" :key="column.status" class="flex flex-col gap-3 rounded-[28px] bg-muted/50 p-3" :aria-label="column.title">
        <h2 class="m-0 flex items-center justify-between gap-2 px-2 pt-1 text-base font-bold text-foreground">
          <span class="flex items-center gap-2"><Icon :name="column.icon" class="size-4" />{{ column.title }}</span>
          <span class="rounded-full bg-card px-2.5 py-0.5 text-sm tabular-nums">{{ inColumn(column.status).length }}</span>
        </h2>
        <article v-for="chat in inColumn(column.status)" :key="chat.id" class="flex flex-col gap-2 rounded-[22px] bg-card p-4 ring-1 ring-black/10 dark:ring-white/10" :class="waitTone(chat)">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="truncate font-semibold text-foreground">
                {{ chat.visitorName }}
              </div>
              <div class="truncate text-xs text-muted-foreground">
                {{ chat.clientName ?? chat.visitorEmail }}
              </div>
            </div>
            <span v-if="chat.waitingSince" class="shrink-0 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums" :class="seconds(chat.waitingSince) > 300 ? 'bg-destructive text-white' : seconds(chat.waitingSince) > 120 ? 'bg-amber-400 text-amber-950' : 'bg-brand-lime text-brand-forest'">
              waiting {{ duration(chat.waitingSince) }}
            </span>
            <span v-else class="shrink-0 text-xs tabular-nums text-muted-foreground">{{ duration(chat.startedAt) }}</span>
          </div>
          <div class="flex flex-wrap items-center gap-1.5 text-xs">
            <span v-if="chat.status === 'ai'" class="inline-flex items-center gap-1 rounded-full bg-brand-mist px-2 py-0.5 font-semibold text-brand-forest dark:bg-brand-spruce dark:text-brand-mist"><Icon name="i-lucide-sparkles" class="size-3" />{{ chat.aiAgentName ?? 'AI' }}<template v-if="chat.aiThinking"> · typing…</template></span>
            <span v-if="chat.assigneeName" class="rounded-full bg-muted px-2 py-0.5 font-semibold">{{ chat.assigneeName }}</span>
            <span v-for="tag in chat.tags" :key="tag.id" class="rounded-full px-2 py-0.5 font-semibold" :class="tagChipClass(tag.color)">{{ tag.name }}</span>
            <span class="text-muted-foreground">{{ chat.messageCount }} messages</span>
          </div>
          <p v-if="chat.handoffReason && chat.status === 'waiting'" class="m-0 text-xs text-muted-foreground">
            From the AI: {{ chat.handoffReason }}
          </p>
          <ol class="m-0 flex list-none flex-col gap-1 rounded-xl bg-muted/60 p-2.5 text-xs">
            <li v-for="(message, index) in chat.recent" :key="index" class="line-clamp-2">
              <b>{{ who(message.authorType, message.authorName) }}:</b> {{ message.body }}
            </li>
          </ol>
          <div class="flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" as-child>
              <NuxtLink :to="`/inbox?open=${chat.id}`">
                Open
              </NuxtLink>
            </Button>
            <Button v-if="chat.status !== 'active'" size="sm" variant="lime" @click="takeOver(chat)">
              {{ chat.status === 'ai' ? 'Take over' : 'Take chat' }}
            </Button>
          </div>
        </article>
        <p v-if="chats && !inColumn(column.status).length" class="m-0 p-4 text-center text-sm text-muted-foreground">
          {{ column.empty }}
        </p>
      </section>
    </div>
  </div>
</template>
