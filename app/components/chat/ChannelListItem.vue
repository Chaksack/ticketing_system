<script setup lang="ts">
import type { ChatChannel } from '~/types/chat'
import { channelDisplayName, channelIcon, channelOtherMember } from '~/lib/chatChannel'

const props = defineProps<{
  channel: ChatChannel
  active: boolean
  currentUserId?: string
}>()

defineEmits<{
  click: []
}>()

const { getPresence } = usePresence()

const displayName = computed(() => channelDisplayName(props.channel, props.currentUserId))
const icon = computed(() => channelIcon(props.channel))
const initials = computed(() => displayName.value.split(' ').map(n => n[0]).slice(0, 2).join(''))
const presence = computed(() => props.channel.type === 'direct' ? getPresence(channelOtherMember(props.channel, props.currentUserId)?.id) : undefined)

const lastMessagePreview = computed(() => {
  const message = props.channel.lastMessage
  if (!message)
    return ''
  if (message.body)
    return message.body
  if (message.attachmentName)
    return `📎 ${message.attachmentName}`
  return ''
})

function formatListTime(value: string) {
  const date = new Date(value)
  const now = new Date()
  if (date.toDateString() === now.toDateString())
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  if (now.getTime() - date.getTime() < 6 * 24 * 60 * 60 * 1000)
    return date.toLocaleDateString(undefined, { weekday: 'short' })
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
</script>

<template>
  <button
    type="button"
    class="w-full flex items-center gap-3 border-b px-4 py-3 text-left transition-colors active:bg-accent/60 md:mx-1 md:w-[calc(100%-0.5rem)] md:rounded-md md:border-b-0 md:px-2 md:py-2 md:hover:bg-accent"
    :class="{ 'bg-accent': active }"
    @click="$emit('click')"
  >
    <div class="relative shrink-0">
      <Avatar class="size-12 md:size-9">
        <AvatarFallback class="text-sm md:text-xs">
          <Icon v-if="icon" :name="icon" class="size-4" />
          <template v-else>
            {{ initials }}
          </template>
        </AvatarFallback>
      </Avatar>
      <PresenceDot v-if="channel.type === 'direct'" :state="presence?.state" class="absolute -bottom-0.5 -right-0.5" />
    </div>
    <div class="flex-1 min-w-0">
      <div class="flex items-center justify-between gap-2">
        <span class="truncate font-medium">{{ displayName }}</span>
        <span v-if="channel.lastMessage" class="shrink-0 text-[11px]" :class="channel.unreadCount ? 'font-medium text-primary' : 'text-muted-foreground'">
          {{ formatListTime(channel.lastMessage.createdAt) }}
        </span>
      </div>
      <div class="flex items-center justify-between gap-2 mt-0.5">
        <p class="truncate text-sm text-muted-foreground">
          <template v-if="channel.lastMessage">
            <span v-if="channel.lastMessage.authorId === currentUserId">You: </span>{{ lastMessagePreview }}
          </template>
          <template v-else>
            No messages yet
          </template>
        </p>
        <Badge v-if="channel.unreadCount > 0" variant="default" class="h-5 min-w-5 shrink-0 justify-center rounded-full px-1.5 text-[10px]">
          {{ channel.unreadCount }}
        </Badge>
      </div>
    </div>
  </button>
</template>
