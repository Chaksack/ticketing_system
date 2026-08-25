<script setup lang="ts">
const { currentUser } = useAuth()
const { pages, fetchPages, acknowledgePage } = useOnCall()
const { fetchTickets } = useTickets()

let pollTimer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  fetchPages()
  pollTimer = setInterval(fetchPages, 20_000)
})

onUnmounted(() => {
  clearInterval(pollTimer)
})

const myNotifications = computed(() =>
  pages.value
    .filter(page => page.staffId === currentUser.value?.id)
    .slice(0, 10),
)

const unreadCount = computed(() => myNotifications.value.filter(n => !n.acknowledged).length)

async function acknowledgeAndRefresh(id: string) {
  await acknowledgePage(id)
  await fetchTickets()
}

async function markAllRead() {
  const unread = myNotifications.value.filter(n => !n.acknowledged)
  if (!unread.length)
    return

  await Promise.all(unread.map(n => acknowledgePage(n.id)))
  await fetchTickets()
}

function onOpenChange(isOpen: boolean) {
  if (!isOpen)
    markAllRead()
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
        <Button v-if="unreadCount > 0" variant="ghost" size="sm" class="h-6 px-2 text-xs" @click="markAllRead">
          Mark all read
        </Button>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />

      <div v-if="!myNotifications.length" class="px-2 py-6 text-center text-sm text-muted-foreground">
        You're all caught up.
      </div>

      <ScrollArea v-else class="max-h-80">
        <DropdownMenuItem
          v-for="notification in myNotifications"
          :key="notification.id"
          class="flex flex-col items-start gap-1 whitespace-normal"
          @select.prevent="acknowledgeAndRefresh(notification.id)"
        >
          <div class="flex w-full items-center gap-2">
            <span v-if="!notification.acknowledged" class="size-1.5 shrink-0 rounded-full bg-primary" />
            <span class="truncate text-sm font-medium">{{ notification.ticketSubject }}</span>
          </div>
          <div class="flex w-full items-center justify-between text-xs text-muted-foreground">
            <span class="font-mono">{{ notification.ticketId }}</span>
            <span>{{ formatDate(notification.createdAt) }}</span>
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
