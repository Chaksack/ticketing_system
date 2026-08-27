<script setup lang="ts">
import type { ChatMessage } from '~/types/chat'
import type { PresenceState } from '~/types/presence'
import { useMediaQuery } from '@vueuse/core'
import { toast } from 'vue-sonner'
import MessageBody from '~/components/chat/MessageBody.vue'
import ReferencePicker from '~/components/chat/ReferencePicker.vue'

const { currentUser } = useAuth()
const { staff, fetchStaff } = useStaff()
const { channels, messagesByChannel, fetchChannels, openDirectChannel, createGroupChannel, updateChannel, fetchMessages, sendMessage, markRead } = useChat()
const { getPresence, fetchPresences } = usePresence()
const route = useRoute()
const router = useRouter()

const isDesktop = useMediaQuery('(min-width: 768px)')

const activeChannelId = ref<string | null>(null)
const activeMessages = computed(() => activeChannelId.value ? (messagesByChannel.value[activeChannelId.value] ?? []) : [])
const activeChannel = computed(() => channels.value.find(c => c.id === activeChannelId.value) ?? null)

const PRESENCE_LABEL: Record<PresenceState, string> = {
  online: 'Online',
  away: 'Away',
  in_meeting: 'In a meeting',
  offline: 'Offline',
}

function otherMember(channel: typeof channels.value[number]) {
  return channel.type === 'direct' ? channel.members.find(m => m.id !== currentUser.value?.id) : undefined
}

function channelDisplayName(channel: typeof channels.value[number]) {
  if (channel.type === 'group')
    return channel.name ?? 'Group chat'

  return otherMember(channel)?.name ?? 'Direct message'
}

function channelPresence(channel: typeof channels.value[number]) {
  return getPresence(otherMember(channel)?.id)
}

function channelInitials(channel: typeof channels.value[number]) {
  return channelDisplayName(channel).split(' ').map(n => n[0]).slice(0, 2).join('')
}

async function selectChannel(channelId: string) {
  activeChannelId.value = channelId
  router.replace({ query: { ...route.query, channel: channelId } })
  await fetchMessages(channelId)
  await markRead(channelId)
  await scrollToBottom()
}

function backToList() {
  activeChannelId.value = null
  const { channel: _omit, ...rest } = route.query
  router.replace({ query: rest })
}

const messageListEl = ref<HTMLElement>()
async function scrollToBottom() {
  await nextTick()
  if (messageListEl.value)
    messageListEl.value.scrollTop = messageListEl.value.scrollHeight
}

onMounted(async () => {
  if (!staff.value.length)
    await fetchStaff()
  await fetchChannels()
  await fetchPresences()

  const openId = typeof route.query.channel === 'string' ? route.query.channel : null
  if (openId) {
    await selectChannel(openId)
  }
  else if (isDesktop.value && channels.value.length) {
    await selectChannel(channels.value[0]!.id)
  }
})

let pollTimer: ReturnType<typeof setInterval> | undefined
let channelPollTimer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  pollTimer = setInterval(async () => {
    if (activeChannelId.value)
      await fetchMessages(activeChannelId.value)
  }, 4000)

  channelPollTimer = setInterval(fetchChannels, 15000)
})

onUnmounted(() => {
  clearInterval(pollTimer)
  clearInterval(channelPollTimer)
})

const draft = ref('')

async function onSend() {
  if (!activeChannelId.value || !draft.value.trim())
    return

  const body = draft.value.trim()
  draft.value = ''
  try {
    await sendMessage(activeChannelId.value, body)
    await scrollToBottom()
  }
  catch (error: any) {
    toast.error('Could not send message', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
    draft.value = body
  }
}

function onInsertReference(token: string) {
  draft.value = draft.value ? `${draft.value} ${token} ` : `${token} `
}

const isNewDmOpen = ref(false)
const activeStaff = computed(() => staff.value.filter(s => s.status === 'active' && s.id !== currentUser.value?.id))

async function onStartDirectMessage(staffId: string) {
  isNewDmOpen.value = false
  const channel = await openDirectChannel(staffId)
  await selectChannel(channel.id)
}

const isNewGroupOpen = ref(false)
const newGroupName = ref('')
const newGroupMemberIds = ref<string[]>([])

async function onCreateGroup() {
  if (!newGroupName.value.trim())
    return

  const channel = await createGroupChannel(newGroupName.value.trim(), newGroupMemberIds.value)
  newGroupName.value = ''
  newGroupMemberIds.value = []
  isNewGroupOpen.value = false
  await selectChannel(channel.id)
}

const isEditGroupOpen = ref(false)
const editGroupName = ref('')
const editGroupMemberIds = ref<string[]>([])

function openEditGroup() {
  if (!activeChannel.value || activeChannel.value.type !== 'group')
    return
  editGroupName.value = activeChannel.value.name ?? ''
  editGroupMemberIds.value = activeChannel.value.members.map(m => m.id)
  isEditGroupOpen.value = true
}

async function onSaveGroup() {
  if (!activeChannelId.value)
    return

  await updateChannel(activeChannelId.value, { name: editGroupName.value.trim(), memberIds: editGroupMemberIds.value })
  isEditGroupOpen.value = false
}

// Consecutive messages from the same author within a short window are visually grouped
// (name shown once at the top of the burst, timestamp shown once at the bottom) — same
// convention as Slack/WhatsApp, rather than repeating the meta line on every bubble.
const GROUP_WINDOW_MS = 5 * 60 * 1000

function isGroupStart(index: number) {
  const message = activeMessages.value[index]
  const prev = activeMessages.value[index - 1]
  if (!message || !prev)
    return true
  if (prev.authorId !== message.authorId)
    return true
  return new Date(message.createdAt).getTime() - new Date(prev.createdAt).getTime() > GROUP_WINDOW_MS
}

function isGroupEnd(index: number) {
  const message = activeMessages.value[index]
  const next = activeMessages.value[index + 1]
  if (!message || !next)
    return true
  if (next.authorId !== message.authorId)
    return true
  return new Date(next.createdAt).getTime() - new Date(message.createdAt).getTime() > GROUP_WINDOW_MS
}

function metaLabel(message: ChatMessage) {
  const time = new Date(message.createdAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return message.authorId === currentUser.value?.id ? `You · ${time}` : time
}

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
  <div class="w-full flex flex-col md:flex-row -m-4 md:m-0 h-[calc(100dvh-var(--header-height))] md:h-[calc(100dvh-var(--header-height)-3rem)] md:gap-4">
    <div
      v-show="isDesktop || !activeChannelId"
      class="w-full md:w-80 shrink-0 flex flex-col min-h-0 bg-background md:border md:rounded-md"
    >
      <div class="flex items-center justify-between gap-2 border-b px-4 py-3 shrink-0">
        <h2 class="text-lg font-semibold md:text-base">
          Chats
        </h2>
        <div class="flex items-center gap-1">
          <Popover v-model:open="isNewDmOpen">
            <PopoverTrigger as-child>
              <Button size="icon-sm" variant="ghost" aria-label="New direct message">
                <Icon name="i-lucide-user-plus" class="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent class="w-[260px] p-0" align="end">
              <Command>
                <CommandInput placeholder="Find a staff member…" />
                <CommandList>
                  <CommandEmpty>No staff found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem v-for="member in activeStaff" :key="member.id" :value="member.name" @select="onStartDirectMessage(member.id)">
                      {{ member.name }}
                    </CommandItem>
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <Button size="icon-sm" variant="ghost" aria-label="New group" @click="isNewGroupOpen = true">
            <Icon name="i-lucide-users" class="size-4" />
          </Button>
        </div>
      </div>

      <ScrollArea class="flex-1 min-h-0">
        <div class="flex flex-col">
          <button
            v-for="channel in channels"
            :key="channel.id"
            type="button"
            class="w-full flex items-center gap-3 border-b px-4 py-3 text-left transition-colors active:bg-accent/60 md:mx-1 md:w-[calc(100%-0.5rem)] md:rounded-md md:border-b-0 md:px-2 md:py-2 md:hover:bg-accent"
            :class="{ 'bg-accent': channel.id === activeChannelId }"
            @click="selectChannel(channel.id)"
          >
            <div class="relative shrink-0">
              <Avatar class="size-12 md:size-9">
                <AvatarFallback class="text-sm md:text-xs">
                  {{ channelInitials(channel) }}
                </AvatarFallback>
              </Avatar>
              <PresenceDot :state="channelPresence(channel)?.state" class="absolute -bottom-0.5 -right-0.5" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between gap-2">
                <span class="truncate font-medium">{{ channelDisplayName(channel) }}</span>
                <span v-if="channel.lastMessage" class="shrink-0 text-[11px]" :class="channel.unreadCount ? 'font-medium text-primary' : 'text-muted-foreground'">
                  {{ formatListTime(channel.lastMessage.createdAt) }}
                </span>
              </div>
              <div class="flex items-center justify-between gap-2 mt-0.5">
                <p class="truncate text-sm text-muted-foreground">
                  <template v-if="channel.lastMessage">
                    <span v-if="channel.lastMessage.authorId === currentUser?.id">You: </span>{{ channel.lastMessage.body }}
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
          <p v-if="!channels.length" class="px-4 py-6 text-center text-sm text-muted-foreground">
            No conversations yet. Start a direct message or group above.
          </p>
        </div>
      </ScrollArea>
    </div>

    <div
      v-show="isDesktop || activeChannelId"
      class="flex-1 flex flex-col min-h-0 min-w-0 bg-background md:border md:rounded-md"
    >
      <template v-if="activeChannel">
        <div class="flex items-center gap-2 border-b px-3 py-2.5 shrink-0 md:px-4 md:py-3">
          <Button v-if="!isDesktop" size="icon-sm" variant="ghost" class="-ml-1 shrink-0" aria-label="Back to chats" @click="backToList">
            <Icon name="i-lucide-chevron-left" class="size-5" />
          </Button>
          <div class="relative shrink-0">
            <Avatar class="size-9">
              <AvatarFallback class="text-xs">
                {{ channelInitials(activeChannel) }}
              </AvatarFallback>
            </Avatar>
            <PresenceDot v-if="activeChannel.type === 'direct'" :state="channelPresence(activeChannel)?.state" class="absolute -bottom-0.5 -right-0.5" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-medium truncate leading-tight">
              {{ channelDisplayName(activeChannel) }}
            </div>
            <div class="text-xs text-muted-foreground truncate leading-tight">
              <template v-if="activeChannel.type === 'group'">
                {{ activeChannel.members.length }} members
              </template>
              <template v-else-if="channelPresence(activeChannel)?.statusText">
                <span v-if="channelPresence(activeChannel)?.statusEmoji">{{ channelPresence(activeChannel)?.statusEmoji }}</span>
                {{ channelPresence(activeChannel)?.statusText }}
              </template>
              <template v-else-if="channelPresence(activeChannel)">
                {{ PRESENCE_LABEL[channelPresence(activeChannel)!.state] }}
              </template>
            </div>
          </div>
          <Button v-if="activeChannel.type === 'group'" size="icon-sm" variant="ghost" class="shrink-0" @click="openEditGroup">
            <Icon name="i-lucide-settings" class="size-4" />
          </Button>
        </div>

        <div ref="messageListEl" class="flex-1 min-h-0 overflow-y-auto flex flex-col p-3 md:p-4">
          <div
            v-for="(message, index) in activeMessages"
            :key="message.id"
            class="flex flex-col"
            :class="[isGroupStart(index) ? 'mt-3' : 'mt-0.5', message.authorId === currentUser?.id ? 'items-end' : 'items-start']"
          >
            <span
              v-if="isGroupStart(index) && activeChannel.type === 'group' && message.authorId !== currentUser?.id"
              class="px-1 mb-0.5 text-[11px] font-medium text-muted-foreground"
            >
              {{ message.authorName }}
            </span>
            <div
              class="max-w-[85%] md:max-w-[70%] rounded-2xl px-3 py-2 text-sm break-words"
              :class="[
                message.authorId === currentUser?.id ? 'bg-primary text-primary-foreground' : 'bg-muted',
                message.authorId === currentUser?.id && isGroupEnd(index) ? 'rounded-br-md' : '',
                message.authorId !== currentUser?.id && isGroupEnd(index) ? 'rounded-bl-md' : '',
              ]"
            >
              <MessageBody :body="message.body" />
            </div>
            <span v-if="isGroupEnd(index)" class="text-[10px] text-muted-foreground px-1 mt-0.5">
              {{ metaLabel(message) }}
            </span>
          </div>
          <p v-if="!activeMessages.length" class="text-center text-sm text-muted-foreground py-6">
            No messages yet. Say hello!
          </p>
        </div>

        <form class="flex items-center gap-2 border-t bg-background px-3 py-2.5 shrink-0 md:py-3" style="padding-bottom: max(0.625rem, env(safe-area-inset-bottom))" @submit.prevent="onSend">
          <ReferencePicker @insert="onInsertReference" />
          <Input v-model="draft" placeholder="Message" class="flex-1 h-10 rounded-full border-none bg-muted focus-visible:ring-1" />
          <Button type="submit" size="icon" class="rounded-full shrink-0" :disabled="!draft.trim()">
            <Icon name="i-lucide-send" class="size-4" />
          </Button>
        </form>
      </template>
      <div v-else class="flex-1 items-center justify-center text-sm text-muted-foreground hidden md:flex">
        Select a conversation to start chatting.
      </div>
    </div>

    <Sheet v-model:open="isNewGroupOpen">
      <SheetContent side="right" class="w-full sm:max-w-md p-6">
        <SheetHeader class="p-0">
          <SheetTitle>New Group</SheetTitle>
          <SheetDescription>
            Create a group conversation with any staff members.
          </SheetDescription>
        </SheetHeader>
        <div class="flex flex-col gap-4 pt-4">
          <div class="flex flex-col gap-1.5">
            <Label class="text-xs text-muted-foreground">Group Name</Label>
            <Input v-model="newGroupName" placeholder="e.g. BD Team" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label class="text-xs text-muted-foreground">Members</Label>
            <StaffAssigneePicker v-model="newGroupMemberIds" :staff="activeStaff" />
          </div>
          <Button :disabled="!newGroupName.trim()" @click="onCreateGroup">
            Create Group
          </Button>
        </div>
      </SheetContent>
    </Sheet>

    <Sheet v-model:open="isEditGroupOpen">
      <SheetContent side="right" class="w-full sm:max-w-md p-6">
        <SheetHeader class="p-0">
          <SheetTitle>Edit Group</SheetTitle>
        </SheetHeader>
        <div class="flex flex-col gap-4 pt-4">
          <div class="flex flex-col gap-1.5">
            <Label class="text-xs text-muted-foreground">Group Name</Label>
            <Input v-model="editGroupName" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label class="text-xs text-muted-foreground">Members</Label>
            <StaffAssigneePicker v-model="editGroupMemberIds" :staff="activeStaff" />
          </div>
          <Button :disabled="!editGroupName.trim()" @click="onSaveGroup">
            Save Changes
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  </div>
</template>
