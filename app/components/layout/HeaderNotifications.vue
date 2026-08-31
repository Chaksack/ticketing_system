<script setup lang="ts">
import type { AppNotification, NotificationType } from '~/types/notification'

const router = useRouter()
const { notifications, fetchNotifications, markRead, markAllRead } = useNotifications()
const { fetchTickets } = useTickets()
const { fetchTasks } = useTasks()
const { fetchLeads } = useLeads()
const { fetchClients } = useClients()
const { fetchChannels } = useChat()

let pollTimer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  fetchNotifications()
  pollTimer = setInterval(fetchNotifications, 20_000)
})

onUnmounted(() => {
  clearInterval(pollTimer)
})

const unreadCount = computed(() => notifications.value.filter(n => !n.read).length)

const TYPE_ICON: Record<NotificationType, string> = {
  ticket_page: 'i-lucide-radio',
  on_call_assigned: 'i-lucide-phone-call',
  internal_note: 'i-lucide-sticky-note',
  reply: 'i-lucide-message-square',
  task_reminder: 'i-lucide-alarm-clock',
  task_assigned: 'i-lucide-user-check',
  lead_reminder: 'i-lucide-target',
  amc_follow_up: 'i-lucide-file-clock',
  chat_message: 'i-lucide-message-square',
  meeting_reminder: 'i-lucide-calendar-clock',
  ticket_escalated: 'i-lucide-arrow-up-circle',
}

async function onSelect(notification: AppNotification) {
  await markRead(notification.id)
  // Refetch whichever list this notification actually affects, not always tickets —
  // otherwise a task/lead/AMC/chat notification leaves that page showing stale data.
  if (notification.taskId)
    await fetchTasks()
  else if (notification.leadId)
    await fetchLeads()
  else if (notification.contractId)
    await fetchClients()
  else if (notification.type === 'chat_message')
    await fetchChannels()
  else
    await fetchTickets()
  if (notification.url)
    router.push(notification.url)
}

async function onMarkAllRead() {
  await markAllRead()
  // Sequential, not Promise.all — db0's postgresql connector shares a single client
  // and warns (and can wedge) on overlapping concurrent queries.
  await fetchTickets()
  await fetchTasks()
  await fetchLeads()
  await fetchClients()
}

function onOpenChange(isOpen: boolean) {
  if (!isOpen)
    onMarkAllRead()
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
</script>

<template>
  <DropdownMenu @update:open="onOpenChange">
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="icon" class="relative">
        <Icon name="i-lucide-bell" class="size-5" />
        <span
          v-if="unreadCount > 0"
          class="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground"
        >
          {{ unreadCount > 9 ? '9+' : unreadCount }}
        </span>
        <span class="sr-only">Notifications</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-80">
      <DropdownMenuLabel class="flex items-center justify-between gap-2">
        <span>Notifications</span>
        <Button v-if="unreadCount > 0" variant="ghost" size="sm" class="h-6 px-2 text-xs" @click="onMarkAllRead">
          Mark all read
        </Button>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />

      <div v-if="!notifications.length" class="px-2 py-6 text-center text-sm text-muted-foreground">
        You're all caught up.
      </div>

      <ScrollArea v-else class="max-h-80">
        <DropdownMenuItem
          v-for="notification in notifications"
          :key="notification.id"
          class="flex flex-col items-start gap-1 whitespace-normal"
          @select.prevent="onSelect(notification)"
        >
          <div class="flex w-full items-center gap-2">
            <span v-if="!notification.read" class="size-1.5 shrink-0 rounded-full bg-primary" />
            <Icon :name="TYPE_ICON[notification.type] ?? 'i-lucide-bell'" class="size-3.5 shrink-0 text-muted-foreground" />
            <span class="truncate text-sm font-medium">{{ notification.title }}</span>
          </div>
          <div class="flex w-full items-center justify-between gap-2 text-xs text-muted-foreground">
            <span class="truncate">{{ notification.body }}</span>
            <span class="shrink-0">{{ formatDate(notification.createdAt) }}</span>
          </div>
        </DropdownMenuItem>
      </ScrollArea>

      <DropdownMenuSeparator />
      <DropdownMenuItem as-child>
        <NuxtLink to="/tickets" @click="fetchTickets">
          View all tickets
        </NuxtLink>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
