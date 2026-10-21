<script setup lang="ts">
import type { Macro } from '~/types/automation'
import type { Ticket, TicketActivity, TicketPriority, TicketReply, TicketStatus } from '~/types/ticket'
import { toast } from 'vue-sonner'
import { escalationLevels, priorities, statuses } from '~/components/tickets/data/data'

// Agent workspace ("Customer Service — Agent workspace" in the Canopy design): queue on the left,
// the case in the middle, customer and knowledge on the right. Replaces the old side sheet.
definePageMeta({ middleware: 'agent' })

const route = useRoute()
const id = computed(() => String(route.params.id))
const { currentUser, hasApp } = useAuth()
const { tickets, fetchTickets, fetchTicket, addReply, updateTicket, addTag, removeTag, applyMacro, escalateTicket } = useTickets()
const { staff, fetchStaff } = useStaff()
const { tags, fetchTags, createTag } = useTags()
const { macros, fetchMacros } = useMacros()
const { clients, fetchClients } = useClients()
const { projects, fetchProjects } = useProjects()

const ticket = computed(() => tickets.value.find(t => t.id === id.value) ?? null)
const notFound = ref(false)
const draft = ref('')
const when = (iso: string) => new Date(iso).toLocaleString(APP_LOCALE, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const time = (iso: string) => new Date(iso).toLocaleTimeString(APP_LOCALE, { hour: '2-digit', minute: '2-digit' })
const similar = ref<{ id: string, subject: string, resolvedAt?: string, resolution?: string }[]>([])

async function loadTicket() {
  try {
    await fetchTicket(id.value)
    // Similar cases are a nicety — fetched without holding up the rest of the page.
    fetchUntyped<{ similar: typeof similar.value }>(`/api/tickets/${id.value}/assist`).then(r => similar.value = r.similar).catch(() => {})
  }
  catch (error: any) {
    if (error?.statusCode === 404)
      notFound.value = true
  }
}

onMounted(async () => {
  await loadTicket()
  // What the case and customer panels show first; the queue and pickers' extras after.
  // (Sequential on purpose — see the note in overview.vue about overlapping queries.)
  if (!staff.value.length)
    await fetchStaff()
  if (hasApp('sales') && !clients.value.length)
    await fetchClients().catch(() => {})
  if (!projects.value.length)
    await fetchProjects().catch(() => {})
  await fetchTickets()
  if (!tags.value.length)
    await fetchTags()
  if (!macros.value.length)
    await fetchMacros()
})
watch(id, () => {
  draft.value = ''
  notFound.value = false
  loadTicket()
})

// ── Queue ─────────────────────────────────────────────────────────────────
type QueueTab = 'mine' | 'unassigned' | 'resolved'
const queueTab = ref<QueueTab>('mine')
const isActive = (t: Ticket) => t.status === 'open' || t.status === 'in-progress'
const queue = computed(() => {
  const list = queueTab.value === 'mine'
    ? tickets.value.filter(t => isActive(t) && t.assigneeId === currentUser.value?.id)
    : queueTab.value === 'unassigned'
      ? tickets.value.filter(t => isActive(t) && !t.assigneeId)
      : tickets.value.filter(t => !isActive(t) && t.assigneeId === currentUser.value?.id)
  return [...list].sort((a, b) => (a.dueAt ?? '9').localeCompare(b.dueAt ?? '9'))
})
const queueTabs = computed(() => [
  { value: 'mine' as const, label: 'Mine', count: tickets.value.filter(t => isActive(t) && t.assigneeId === currentUser.value?.id).length },
  { value: 'unassigned' as const, label: 'Unassigned', count: tickets.value.filter(t => isActive(t) && !t.assigneeId).length },
  { value: 'resolved' as const, label: 'Resolved' },
])

function timeLeft(iso?: string) {
  if (!iso)
    return '—'
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60000)
  const abs = Math.abs(minutes)
  const label = abs < 60 ? `${abs}m` : abs < 2880 ? `${Math.floor(abs / 60)}h ${abs % 60}m` : `${Math.round(abs / 1440)} days`
  return minutes < 0 ? `${label} overdue` : `${label} left`
}
function queueDeadline(t: Ticket) {
  if (!t.firstResponseAt && t.firstResponseDueAt)
    return `First response · ${timeLeft(t.firstResponseDueAt)}`
  return t.dueAt ? `Resolve by · ${timeLeft(t.dueAt)}` : 'No SLA'
}
const PRIORITY_PILL: Record<TicketPriority, string> = {
  urgent: 'bg-destructive text-white',
  high: 'bg-brand-forest text-brand-lime',
  medium: 'bg-brand-mist text-brand-forest',
  low: 'bg-brand-fog text-brand-forest',
}

// ── Case header ───────────────────────────────────────────────────────────
const activeStaff = computed(() => staff.value.filter(s => s.status === 'active'))
const statusLabel = (value: TicketStatus) => statuses.find(s => s.value === value)?.label ?? value
const priorityLabel = (value: TicketPriority) => priorities.find(p => p.value === value)?.label ?? value
const escalation = computed(() => escalationLevels.find(l => l.value === ticket.value?.escalationLevel))
const canEscalate = computed(() => {
  if (!ticket.value || !isActive(ticket.value))
    return false
  const index = ticket.value.escalationLevel ? escalationLevels.findIndex(l => l.value === ticket.value!.escalationLevel) : -1
  return index < escalationLevels.length - 1
})

const firstResponse = computed(() => {
  const t = ticket.value
  if (!t)
    return { label: '', value: '' }
  if (t.firstResponseAt) {
    const minutes = Math.round((new Date(t.firstResponseAt).getTime() - new Date(t.createdAt).getTime()) / 60000)
    const met = !t.firstResponseDueAt || t.firstResponseAt <= t.firstResponseDueAt
    return { label: met ? 'Met' : 'Missed', value: minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`, ok: met }
  }
  return { label: 'Due', value: timeLeft(t.firstResponseDueAt), ok: !t.firstResponseDueAt || new Date(t.firstResponseDueAt) > new Date() }
})
const resolveBy = computed(() => {
  const t = ticket.value
  if (!t?.dueAt)
    return { value: 'No target', note: '', ok: true }
  if (t.resolvedAt)
    return { value: t.resolvedAt <= t.dueAt ? 'Met' : 'Missed', note: when(t.resolvedAt), ok: t.resolvedAt <= t.dueAt }
  return { value: new Date(t.dueAt).toLocaleTimeString(APP_LOCALE, { hour: '2-digit', minute: '2-digit' }), note: timeLeft(t.dueAt), ok: new Date(t.dueAt) > new Date() }
})

async function setStatus(value: TicketStatus) {
  if (ticket.value) {
    await updateTicket(ticket.value.id, { status: value })
    toast(`Status: ${statusLabel(value)}`)
  }
}
async function setPriority(value: TicketPriority) {
  if (ticket.value)
    await updateTicket(ticket.value.id, { priority: value })
}
async function setAssignee(value: string) {
  if (!ticket.value)
    return
  await updateTicket(ticket.value.id, { assigneeId: value === 'unassigned' ? null : value })
  toast(value === 'unassigned' ? 'Ticket unassigned' : `Assigned to ${staff.value.find(s => s.id === value)?.name}`)
}
async function escalate() {
  if (!ticket.value)
    return
  try {
    const updated = await escalateTicket(ticket.value.id)
    toast('Ticket escalated', { description: escalationLevels.find(l => l.value === updated.escalationLevel)?.label })
  }
  catch (error: any) {
    toast.error('Could not escalate', { description: error?.data?.statusMessage })
  }
}

const ticketTagIds = computed(() => new Set(ticket.value?.tags.map(t => t.id) ?? []))
const availableTags = computed(() => tags.value.filter(t => !ticketTagIds.value.has(t.id)))
const newTagName = ref('')
async function toggleTag(tagId: string) {
  if (!ticket.value)
    return
  if (ticketTagIds.value.has(tagId))
    await removeTag(ticket.value.id, tagId)
  else
    await addTag(ticket.value.id, { tagId })
}
async function createAndAttachTag() {
  if (!ticket.value || !newTagName.value.trim())
    return
  const tag = await createTag(newTagName.value.trim())
  await addTag(ticket.value.id, { tagId: tag.id })
  newTagName.value = ''
}

// ── Conversation ──────────────────────────────────────────────────────────
type Entry = { kind: 'reply', at: string, reply: TicketReply } | { kind: 'activity', at: string, activity: TicketActivity }
const timeline = computed<Entry[]>(() => ticket.value
  ? [
      ...ticket.value.replies.map(reply => ({ kind: 'reply' as const, at: reply.createdAt, reply })),
      ...ticket.value.activity.map(activity => ({ kind: 'activity' as const, at: activity.createdAt, activity })),
    ].sort((a, b) => a.at.localeCompare(b.at))
  : [])

function activityLabel(activity: TicketActivity) {
  const actor = activity.actorName ?? 'Someone'
  switch (activity.type) {
    case 'status_changed': return `${actor} changed status from ${activity.fromValue} to ${activity.toValue}`
    case 'priority_changed': return `${actor} changed priority from ${activity.fromValue} to ${activity.toValue}`
    case 'assignee_changed': return `${actor} assigned to ${activity.toValue}`
    case 'escalated': return `${actor} escalated to ${activity.toValue}`
    case 'tag_added': return `${actor} added tag "${activity.toValue}"`
    case 'tag_removed': return `${actor} removed tag "${activity.fromValue}"`
    default: return activity.message ?? `${actor} updated the ticket`
  }
}

const internal = ref(false)
const sending = ref(false)
async function send() {
  if (!ticket.value || !draft.value.trim())
    return
  sending.value = true
  try {
    await addReply(ticket.value.id, draft.value.trim(), internal.value)
    toast(internal.value ? 'Internal note added' : 'Reply sent')
    draft.value = ''
    internal.value = false
  }
  catch (error: any) {
    toast.error('Not sent', { description: error?.data?.statusMessage })
  }
  finally {
    sending.value = false
  }
}
function insert(text: string) {
  draft.value = draft.value.trim() ? `${draft.value.trimEnd()}\n\n${text}` : text
}

const isMacroOpen = ref(false)
async function onApplyMacro(macro: Macro) {
  if (!ticket.value)
    return
  await applyMacro(ticket.value.id, macro.id)
  isMacroOpen.value = false
  toast('Macro applied', { description: macro.name })
}

const drafting = ref(false)
async function draftWithAssist() {
  if (!ticket.value)
    return
  drafting.value = true
  try {
    insert((await fetchUntyped<{ suggestion: string }>(`/api/tickets/${ticket.value.id}/suggest`, { method: 'POST' })).suggestion)
    internal.value = false
  }
  catch (error: any) {
    toast.error('Assist couldn\'t draft a reply', { description: error?.data?.statusMessage })
  }
  finally {
    drafting.value = false
  }
}

// ── Customer ──────────────────────────────────────────────────────────────
const customer = computed(() => {
  if (ticket.value?.clientId)
    return clients.value.find(c => c.id === ticket.value!.clientId) ?? null
  const email = ticket.value?.requesterEmail.toLowerCase()
  if (!email)
    return null
  return clients.value.find(c => c.contactEmail?.toLowerCase() === email || c.additionalEmails.some(e => e.email.toLowerCase() === email) || c.contacts.some(p => p.email?.toLowerCase() === email)) ?? null
})
const customerContact = computed(() => customer.value?.contacts.find(p => p.email?.toLowerCase() === ticket.value?.requesterEmail.toLowerCase()))
const clientProjects = computed(() => projects.value.filter(p => p.clientId === (ticket.value?.clientId ?? customer.value?.id)))
async function setClient(value: string) {
  if (!ticket.value)
    return
  try {
    await updateTicket(ticket.value.id, { clientId: value === 'none' ? null : value, projectId: null })
    toast(value === 'none' ? 'Client removed' : `Linked to ${clients.value.find(c => c.id === value)?.name}`)
  }
  catch (error: any) {
    toast.error('Could not link the client', { description: error?.data?.statusMessage })
  }
}
async function setProject(value: string) {
  if (!ticket.value)
    return
  try {
    const updated = await updateTicket(ticket.value.id, { clientId: ticket.value.clientId ?? customer.value?.id ?? null, projectId: value === 'none' ? null : value })
    toast(updated.entitlement ? `Covered by ${updated.entitlement}` : 'Project updated', { description: updated.entitlement ? 'The contract\'s SLA now applies to this ticket.' : undefined })
  }
  catch (error: any) {
    toast.error('Could not link the project', { description: error?.data?.statusMessage })
  }
}
const openCasesForRequester = computed(() => tickets.value.filter(t => t.requesterEmail.toLowerCase() === ticket.value?.requesterEmail.toLowerCase() && isActive(t)).length)

// ── Resolve (the design's "Resolve case & customer survey") ───────────────
const isResolveOpen = ref(false)
const RESOLUTION_TYPES = ['Fixed on site', 'Fixed remotely', 'Information provided', 'Not reproducible', 'Duplicate'] as const
const resolveForm = reactive({ type: 'Fixed remotely' as string, summary: '', draftArticle: false, sendSurvey: true })
const resolving = ref(false)
async function resolve() {
  if (!ticket.value || !resolveForm.summary.trim())
    return
  resolving.value = true
  const ticketId = ticket.value.id
  try {
    await addReply(ticketId, `Resolution (${resolveForm.type}): ${resolveForm.summary.trim()}`, true)
    await updateTicket(ticketId, { status: 'resolved' })
    if (resolveForm.sendSurvey) {
      await $fetch(`/api/tickets/${ticketId}/survey`, { method: 'POST' }).catch((error: any) => toast.error('Survey not sent', { description: error?.data?.statusMessage }))
    }
    isResolveOpen.value = false
    toast(`${ticketId} resolved`, { description: resolveForm.sendSurvey ? 'The customer has been sent a one-question survey.' : undefined })
    if (resolveForm.draftArticle) {
      const { article } = await fetchUntyped<{ article: { id: string } }>('/api/knowledge/from-ticket', { method: 'POST', body: { ticketId } })
      await navigateTo(`/knowledge/${article.id}`)
    }
  }
  catch (error: any) {
    toast.error('Could not resolve', { description: error?.data?.statusMessage })
  }
  finally {
    resolving.value = false
  }
}
</script>

<template>
  <div class="grid w-full items-start gap-4 lg:grid-cols-[300px_minmax(0,1fr)] 2xl:grid-cols-[320px_minmax(0,1fr)_340px]">
    <!-- Queue -->
    <section aria-label="My queue" class="flex max-h-[calc(100vh-8rem)] flex-col gap-2.5 overflow-y-auto rounded-[28px] bg-card p-4 ring-1 ring-black/10 lg:sticky lg:top-4 dark:ring-white/10">
      <div class="flex items-center justify-between">
        <h2 class="m-0 text-base font-bold text-foreground">
          My queue
        </h2>
        <NuxtLink to="/tickets" class="text-xs font-semibold text-primary hover:underline dark:text-brand-lime">
          All tickets
        </NuxtLink>
      </div>
      <PageSegmentedTabs v-model="queueTab" label="Queue" :options="queueTabs" />
      <NuxtLink
        v-for="item in queue"
        :key="item.id"
        :to="`/tickets/${item.id}`"
        class="flex flex-col gap-1 rounded-2xl p-3 transition-colors"
        :class="item.id === id ? 'bg-brand-mist ring-2 ring-brand-forest dark:bg-brand-spruce' : 'ring-1 ring-black/10 hover:bg-muted dark:ring-white/10'"
        :aria-current="item.id === id ? 'page' : undefined"
      >
        <span class="flex items-start justify-between gap-2">
          <span class="text-sm font-bold text-foreground">{{ item.subject }}</span>
          <span class="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold" :class="PRIORITY_PILL[item.priority]">{{ priorityLabel(item.priority) }}</span>
        </span>
        <span class="truncate text-xs text-muted-foreground">{{ item.requester }} · {{ item.id }}</span>
        <span class="text-xs font-semibold" :class="queueDeadline(item).includes('overdue') ? 'text-destructive' : 'text-primary dark:text-brand-lime'">{{ isActive(item) ? queueDeadline(item) : statusLabel(item.status) }}</span>
      </NuxtLink>
      <p v-if="!queue.length" class="m-0 p-3 text-center text-sm text-muted-foreground">
        Nothing here.
      </p>
    </section>

    <!-- Case -->
    <section aria-label="Case" class="flex min-w-0 flex-col gap-3.5">
      <p v-if="notFound" class="rounded-[28px] bg-card p-6 text-muted-foreground ring-1 ring-black/10">
        This ticket doesn't exist or was deleted.
      </p>
      <template v-else-if="ticket">
        <div class="flex flex-col gap-4 rounded-[28px] bg-card p-5 ring-1 ring-black/10 sm:p-6 dark:ring-white/10">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="text-[13px] font-semibold text-muted-foreground">
                Case {{ ticket.id }} · {{ ticket.category }}<template v-if="customer">
                  · {{ customer.name }}
                </template>
              </div>
              <h1 class="m-0 mt-1 text-3xl font-black leading-none tracking-[-0.045em] text-foreground sm:text-[40px]">
                {{ ticket.subject }}
              </h1>
            </div>
            <div class="flex flex-wrap gap-2">
              <TicketsCreateWorkOrderButton :ticket-id="ticket.id" class="h-9 text-sm" />
              <Button v-if="canEscalate" variant="outline" @click="escalate">
                Escalate
              </Button>
              <Button v-if="isActive(ticket)" variant="lime" @click="isResolveOpen = true">
                Resolve case
              </Button>
              <Button v-else variant="outline" @click="setStatus('open')">
                Reopen
              </Button>
            </div>
          </div>

          <div class="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            <div class="rounded-2xl p-3.5" :class="firstResponse.ok ? 'bg-brand-mist text-brand-forest' : 'bg-destructive/10 text-destructive'">
              <div class="text-[13px]">
                First response
              </div>
              <div class="mt-1 font-bold">
                {{ firstResponse.label }} · {{ firstResponse.value }}
              </div>
            </div>
            <div class="rounded-2xl p-3.5" :class="resolveBy.ok ? 'bg-brand-mist text-brand-forest' : 'bg-destructive/10 text-destructive'">
              <div class="text-[13px]">
                Resolve by
              </div>
              <div class="mt-1 font-bold">
                {{ resolveBy.value }} <span class="font-medium">{{ resolveBy.note }}</span>
              </div>
            </div>
            <div class="rounded-2xl bg-brand-fog p-3.5 text-brand-forest dark:bg-muted dark:text-foreground">
              <div class="text-[13px]">
                Coverage
              </div>
              <div class="mt-1 truncate font-bold" :title="ticket.entitlement ? `${ticket.entitlement} contract SLA` : 'Company SLA policy'">
                {{ ticket.entitlement ?? 'Company SLA' }}<span v-if="ticket.projectName" class="font-medium"> · {{ ticket.projectName }}</span>
              </div>
            </div>
            <div class="rounded-2xl bg-brand-fog p-3.5 text-brand-forest dark:bg-muted dark:text-foreground">
              <div class="text-[13px]">
                Escalation
              </div>
              <div class="mt-1 font-bold">
                {{ escalation?.label ?? 'None' }}
              </div>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <Select :model-value="ticket.status" @update:model-value="(v) => setStatus(v as TicketStatus)">
              <SelectTrigger class="h-8 w-auto gap-1.5 rounded-full text-xs" aria-label="Status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="s in statuses" :key="s.value" :value="s.value">
                  {{ s.label }}
                </SelectItem>
              </SelectContent>
            </Select>
            <Select :model-value="ticket.priority" @update:model-value="(v) => setPriority(v as TicketPriority)">
              <SelectTrigger class="h-8 w-auto gap-1.5 rounded-full text-xs" aria-label="Priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="p in priorities" :key="p.value" :value="p.value">
                  {{ p.label }}
                </SelectItem>
              </SelectContent>
            </Select>
            <Select :model-value="ticket.assigneeId ?? 'unassigned'" @update:model-value="(v) => setAssignee(String(v))">
              <SelectTrigger class="h-8 w-auto gap-1.5 rounded-full text-xs" aria-label="Assignee">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">
                  Unassigned
                </SelectItem>
                <SelectItem v-for="member in activeStaff" :key="member.id" :value="member.id">
                  {{ member.name }}
                </SelectItem>
              </SelectContent>
            </Select>
            <Badge v-for="tag in ticket.tags" :key="tag.id" variant="secondary" class="gap-1">
              {{ tag.name }}
              <button type="button" :aria-label="`Remove tag ${tag.name}`" @click="toggleTag(tag.id)">
                <Icon name="i-lucide-x" class="size-3" />
              </button>
            </Badge>
            <Popover>
              <PopoverTrigger as-child>
                <Button variant="outline" size="sm" class="h-8">
                  <Icon name="i-lucide-plus" /> Tag
                </Button>
              </PopoverTrigger>
              <PopoverContent class="w-[220px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search tags…" />
                  <CommandList>
                    <CommandEmpty class="p-2 text-xs text-muted-foreground">
                      No matching tags.
                    </CommandEmpty>
                    <CommandGroup>
                      <CommandItem v-for="tag in availableTags" :key="tag.id" :value="tag.name" @select="toggleTag(tag.id)">
                        {{ tag.name }}
                      </CommandItem>
                    </CommandGroup>
                  </CommandList>
                </Command>
                <form class="flex items-center gap-1 border-t p-2" @submit.prevent="createAndAttachTag">
                  <Input v-model="newTagName" placeholder="New tag" class="h-8 text-xs" aria-label="New tag name" />
                  <Button type="submit" size="icon-sm" variant="ghost" aria-label="Create tag" :disabled="!newTagName.trim()">
                    <Icon name="i-lucide-plus" />
                  </Button>
                </form>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div class="flex flex-col gap-3 rounded-[28px] bg-card p-5 ring-1 ring-black/10 sm:p-6 dark:ring-white/10">
          <h2 class="m-0 text-lg font-bold text-foreground">
            Conversation
          </h2>
          <div class="rounded-2xl bg-brand-fog p-4 text-sm leading-relaxed text-brand-obsidian dark:bg-muted dark:text-foreground">
            <div class="mb-1 text-xs font-semibold text-muted-foreground">
              {{ ticket.requester }} · {{ when(ticket.createdAt) }}
            </div>
            <p class="m-0 whitespace-pre-wrap">
              {{ ticket.description }}
            </p>
            <div v-if="ticket.attachments?.length" class="mt-2 flex flex-wrap gap-1.5">
              <a v-for="file in ticket.attachments" :key="file.name" :href="file.url" target="_blank" rel="noopener noreferrer">
                <Badge variant="outline" class="gap-1 bg-card"><Icon name="i-lucide-paperclip" class="size-3" />{{ file.name }}</Badge>
              </a>
            </div>
          </div>
          <template v-for="entry in timeline" :key="`${entry.kind}-${entry.kind === 'reply' ? entry.reply.id : entry.activity.id}`">
            <div
              v-if="entry.kind === 'reply'"
              class="rounded-2xl p-4 text-sm leading-relaxed"
              :class="entry.reply.internal
                ? 'bg-amber-50 ring-1 ring-amber-300 dark:bg-amber-950/30 dark:ring-amber-900'
                : entry.reply.authorType === 'staff' ? 'ml-6 bg-brand-mist text-brand-obsidian dark:bg-brand-spruce dark:text-white' : 'mr-6 bg-brand-fog text-brand-obsidian dark:bg-muted dark:text-foreground'"
            >
              <div class="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                {{ entry.reply.author }} · {{ time(entry.reply.createdAt) }}
                <Badge v-if="entry.reply.internal" variant="outline" class="border-amber-400 text-[10px] text-amber-700 dark:text-amber-400">
                  Internal note
                </Badge>
              </div>
              <p class="m-0 whitespace-pre-wrap">
                {{ entry.reply.message }}
              </p>
            </div>
            <p v-else class="m-0 text-center text-xs text-muted-foreground">
              {{ activityLabel(entry.activity) }} · {{ when(entry.at) }}
            </p>
          </template>

          <form class="flex flex-col gap-2 border-t pt-4" @submit.prevent="send">
            <Label for="ticket-reply" class="text-[13px] font-semibold">{{ internal ? 'Internal note (staff only)' : `Reply to ${ticket.requester}` }}</Label>
            <Textarea id="ticket-reply" v-model="draft" rows="4" :placeholder="internal ? 'Add a note visible to staff only…' : 'Write a reply…'" />
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex flex-wrap items-center gap-3">
                <label for="ticket-internal" class="flex items-center gap-2 text-sm">
                  <Switch id="ticket-internal" v-model="internal" /> Internal note
                </label>
                <Popover v-model:open="isMacroOpen">
                  <PopoverTrigger as-child>
                    <Button type="button" variant="ghost" size="sm">
                      <Icon name="i-lucide-zap" /> Macros
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent class="w-[260px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search macros…" />
                      <CommandList>
                        <CommandEmpty class="p-3 text-xs text-muted-foreground">
                          No macros yet.
                        </CommandEmpty>
                        <CommandGroup>
                          <CommandItem v-for="macro in macros" :key="macro.id" :value="macro.name" @select="onApplyMacro(macro)">
                            <div class="flex flex-col">
                              <span>{{ macro.name }}</span>
                              <span class="line-clamp-1 text-xs text-muted-foreground">{{ macro.body }}</span>
                            </div>
                          </CommandItem>
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <Button type="button" variant="ghost" size="sm" :disabled="drafting" @click="draftWithAssist">
                  <Icon name="i-lucide-sparkles" /> {{ drafting ? 'Drafting…' : 'Draft with Assist' }}
                </Button>
              </div>
              <Button type="submit" :disabled="sending || !draft.trim()">
                {{ internal ? 'Add note' : 'Send' }}
              </Button>
            </div>
          </form>
        </div>
      </template>
      <p v-else class="text-sm text-muted-foreground">
        Loading…
      </p>
    </section>

    <!-- Customer & knowledge -->
    <aside v-if="ticket" aria-label="Customer and knowledge" class="grid items-start gap-3.5 md:grid-cols-3 lg:col-span-2 2xl:col-span-1 2xl:grid-cols-1">
      <RecordCard tone="forest">
        <span class="self-start rounded-full bg-brand-lime px-3 py-1 text-xs font-bold text-brand-forest">Canopy Assist</span>
        <template v-if="similar.length">
          <p v-for="item in similar" :key="item.id" class="m-0 text-sm leading-normal">
            A similar case, <NuxtLink :to="`/tickets/${item.id}`" class="font-semibold text-brand-lime underline">
              {{ item.id }}
            </NuxtLink> "{{ item.subject }}", was resolved<template v-if="item.resolvedAt">
              on {{ new Date(item.resolvedAt).toLocaleDateString(APP_LOCALE, { day: 'numeric', month: 'short' }) }}
            </template><template v-if="item.resolution">
              : {{ item.resolution }}
            </template>
          </p>
        </template>
        <p v-else class="m-0 text-sm text-brand-mist">
          No similar resolved cases yet.
        </p>
      </RecordCard>

      <RecordCard title="Customer">
        <div class="font-semibold text-foreground">
          {{ customer?.name ?? ticket.clientName ?? ticket.requester }}
        </div>
        <div class="grid gap-2">
          <Select :model-value="ticket.clientId ?? 'none'" @update:model-value="(v) => setClient(String(v))">
            <SelectTrigger class="w-full" aria-label="Client">
              <SelectValue :placeholder="ticket.clientName ?? 'Client'" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">
                {{ customer && !ticket.clientId ? `Not linked (email matches ${customer.name})` : 'No client' }}
              </SelectItem>
              <SelectItem v-for="c in clients" :key="c.id" :value="c.id">
                {{ c.name }}
              </SelectItem>
            </SelectContent>
          </Select>
          <Select :model-value="ticket.projectId ?? 'none'" :disabled="!ticket.clientId && !customer" @update:model-value="(v) => setProject(String(v))">
            <SelectTrigger class="w-full" aria-label="Project">
              <SelectValue :placeholder="ticket.projectName ?? 'Project'" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">
                {{ clientProjects.length ? 'No project' : 'This client has no projects' }}
              </SelectItem>
              <SelectItem v-for="p in clientProjects" :key="p.id" :value="p.id">
                {{ p.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="text-sm text-muted-foreground">
          Contact: {{ customerContact?.name ?? ticket.requester }}<template v-if="customerContact?.title">
            , {{ customerContact.title }}
          </template>
        </div>
        <div class="text-sm text-muted-foreground">
          {{ ticket.requesterEmail }}<template v-if="ticket.requesterPhone">
            · <a :href="`tel:${ticket.requesterPhone.replace(/[^\d+]/g, '')}`" class="underline">{{ ticket.requesterPhone }}</a>
          </template>
        </div>
        <div class="text-sm">
          Open cases from this requester: {{ openCasesForRequester }}<template v-if="ticket.referenceNumber">
            · Ref {{ ticket.referenceNumber }}
          </template>
        </div>
        <div class="flex flex-wrap gap-x-4 gap-y-1">
          <NuxtLink v-if="customer || ticket.clientId" :to="`/clients/${customer?.id ?? ticket.clientId}`" class="text-sm font-semibold text-primary underline-offset-2 hover:underline dark:text-brand-lime">
            Open client record
          </NuxtLink>
          <NuxtLink v-if="ticket.projectId" :to="`/projects/${ticket.projectId}`" class="text-sm font-semibold text-primary underline-offset-2 hover:underline dark:text-brand-lime">
            Open project
          </NuxtLink>
        </div>
      </RecordCard>

      <TicketsKnowledgeSuggestions :ticket="ticket" @insert="insert" />
    </aside>

    <Dialog v-model:open="isResolveOpen">
      <DialogContent v-if="ticket" class="rounded-[28px] sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Resolve: {{ ticket.subject }}</DialogTitle>
          <DialogDescription>The summary is saved on the case as an internal note.</DialogDescription>
        </DialogHeader>
        <form class="flex flex-col gap-4" @submit.prevent="resolve">
          <div class="flex flex-col gap-1.5">
            <Label for="resolve-type">Resolution type</Label>
            <Select v-model="resolveForm.type">
              <SelectTrigger id="resolve-type" class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="type in RESOLUTION_TYPES" :key="type" :value="type">
                  {{ type }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="resolve-summary">Resolution summary</Label>
            <Textarea id="resolve-summary" v-model="resolveForm.summary" rows="4" placeholder="What was wrong, and what fixed it?" />
          </div>
          <label class="flex items-center gap-2.5 text-sm">
            <Checkbox v-model="resolveForm.draftArticle" /> Turn this into a knowledge article (Assist drafts it)
          </label>
          <label class="flex items-center gap-2.5 text-sm">
            <Checkbox v-model="resolveForm.sendSurvey" /> Send a satisfaction survey to {{ ticket.requesterEmail }}
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" @click="isResolveOpen = false">
              Back to case
            </Button>
            <Button type="submit" variant="lime" :disabled="resolving || !resolveForm.summary.trim()">
              Resolve case
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>
</template>
