<script setup lang="ts">
const { unreadCount, fetchUnreadCount } = useChat()

let pollTimer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  fetchUnreadCount()
  pollTimer = setInterval(fetchUnreadCount, 15_000)
})

onUnmounted(() => {
  clearInterval(pollTimer)
})
</script>

<template>
  <Button variant="ghost" size="icon" class="relative" as-child>
    <NuxtLink to="/chat">
      <Icon name="i-lucide-message-square" class="size-5" />
      <span
        v-if="unreadCount > 0"
        class="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground"
      >
        {{ unreadCount > 9 ? '9+' : unreadCount }}
      </span>
      <span class="sr-only">Chat</span>
    </NuxtLink>
  </Button>
</template>
