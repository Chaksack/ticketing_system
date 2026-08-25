<script setup lang="ts">
const { isLoggedIn } = useAuth()
const { notifications, fetchNotifications, markRead } = useNotifications()

let pollTimer: ReturnType<typeof setInterval> | undefined

function pollNotifications() {
  if (isLoggedIn.value)
    fetchNotifications().catch(() => {})
}

onMounted(() => {
  pollNotifications()
  pollTimer = setInterval(pollNotifications, 20_000)
})

onUnmounted(() => {
  clearInterval(pollTimer)
})

watch(isLoggedIn, (loggedIn) => {
  if (loggedIn)
    pollNotifications()
})

// Oldest unacknowledged page first — work through them one at a time, in the order they happened.
const activePage = computed(() =>
  notifications.value
    .filter(n => n.type === 'ticket_page' && !n.read)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0] ?? null,
)

const isOpen = computed(() => !!activePage.value)

// Covers both cases: a live push arriving while the app is already open, and opening/reloading
// the app while a page from earlier is still unacknowledged.
watch(activePage, (page) => {
  if (page)
    useAlarm().start()
}, { immediate: true })

const isAcknowledging = ref(false)

async function onAcknowledge() {
  if (!activePage.value)
    return

  isAcknowledging.value = true
  try {
    await markRead(activePage.value.id)
  }
  finally {
    isAcknowledging.value = false
  }
}

function preventClose(event: Event) {
  event.preventDefault()
}
</script>

<template>
  <AlertDialog :open="isOpen">
    <AlertDialogContent v-if="activePage" @escape-key-down="preventClose" @pointer-down-outside="preventClose">
      <AlertDialogHeader>
        <AlertDialogTitle class="flex items-center gap-2 text-destructive">
          <Icon name="i-lucide-alarm-clock" class="size-5 animate-pulse" />
          You're being paged
        </AlertDialogTitle>
        <AlertDialogDescription>
          {{ activePage.body }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <p class="text-sm font-medium">
        {{ activePage.title }}
      </p>
      <AlertDialogFooter>
        <AlertDialogAction :disabled="isAcknowledging" @click="onAcknowledge">
          Acknowledge
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
