<script setup lang="ts">
import type { BrowsableChatChannel, ChatChannel, ChatMessage } from '~/types/chat'
import type { PresenceState } from '~/types/presence'
import { useMediaQuery } from '@vueuse/core'
import { toast } from 'vue-sonner'
import MessageBody from '~/components/chat/MessageBody.vue'
import ReactionPicker from '~/components/chat/ReactionPicker.vue'
import ReferencePicker from '~/components/chat/ReferencePicker.vue'
import { channelOtherMember, channelDisplayName as sharedChannelDisplayName } from '~/lib/chatChannel'

const { currentUser } = useAuth()
const { staff, fetchStaff } = useStaff()
const { channels, messagesByChannel, fetchChannels, fetchBrowsableChannels, openDirectChannel, createGroupChannel, createProjectChannel, joinChannel, leaveChannel, updateChannel, fetchMessages, sendMessage, toggleReaction, markRead } = useChat()
const { projects, fetchProjects } = useProjects()
const { getPresence, fetchPresences } = usePresence()
const route = useRoute()
const router = useRouter()

const isDesktop = useMediaQuery('(min-width: 768px)')

const activeChannelId = ref<string | null>(null)
const activeMessages = computed(() => activeChannelId.value ? (messagesByChannel.value[activeChannelId.value] ?? []) : [])
const activeChannel = computed(() => channels.value.find(c => c.id === activeChannelId.value) ?? null)

const projectChannels = computed(() => channels.value.filter(c => c.type === 'project'))
const conversationChannels = computed(() => channels.value.filter(c => c.type !== 'project'))

const PRESENCE_LABEL: Record<PresenceState, string> = {
  online: 'Online',
  away: 'Away',
  in_meeting: 'In a meeting',
  offline: 'Offline',
}

function otherMember(channel: ChatChannel) {
  return channelOtherMember(channel, currentUser.value?.id)
}

function channelDisplayName(channel: ChatChannel) {
  return sharedChannelDisplayName(channel, currentUser.value?.id)
}

function channelPresence(channel: ChatChannel) {
  return getPresence(otherMember(channel)?.id)
}

function channelInitials(channel: ChatChannel) {
  return channelDisplayName(channel).split(' ').map(n => n[0]).slice(0, 2).join('')
}

async function selectChannel(channelId: string) {
  activeChannelId.value = channelId
  router.replace({ query: { ...route.query, channel: channelId } })
  await fetchMessages(channelId)
  await markRead(channelId)
}

function backToList() {
  activeChannelId.value = null
  const { channel: _omit, ...rest } = route.query
  router.replace({ query: rest })
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

const ALLOWED_ATTACHMENT_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
])
const MAX_ATTACHMENT_SIZE = 4 * 1024 * 1024

const attachmentInput = ref<HTMLInputElement>()
const pendingAttachment = ref<File | null>(null)
const pendingAttachmentPreviewUrl = ref<string | null>(null)

function onAttachmentButtonClick() {
  attachmentInput.value?.click()
}

function clearPendingAttachment() {
  if (pendingAttachmentPreviewUrl.value)
    URL.revokeObjectURL(pendingAttachmentPreviewUrl.value)
  pendingAttachment.value = null
  pendingAttachmentPreviewUrl.value = null
}

function onAttachmentChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file)
    return

  if (!ALLOWED_ATTACHMENT_TYPES.has(file.type)) {
    toast.error('Could not attach file', {
      description: 'That file type is not supported.',
    })
    return
  }

  if (file.size > MAX_ATTACHMENT_SIZE) {
    toast.error('Could not attach file', {
      description: 'File must be smaller than 4MB.',
    })
    return
  }

  clearPendingAttachment()
  pendingAttachment.value = file
  if (file.type.startsWith('image/'))
    pendingAttachmentPreviewUrl.value = URL.createObjectURL(file)
}

async function onSend() {
  if (!activeChannelId.value || (!draft.value.trim() && !pendingAttachment.value))
    return

  const body = draft.value.trim()
  const file = pendingAttachment.value
  draft.value = ''
  clearPendingAttachment()
  try {
    await sendMessage(activeChannelId.value, body, file)
  }
  catch (error: any) {
    toast.error('Could not send message', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
    draft.value = body
    pendingAttachment.value = file
    if (file?.type.startsWith('image/'))
      pendingAttachmentPreviewUrl.value = URL.createObjectURL(file)
  }
}

function formatFileSize(bytes?: number) {
  if (!bytes)
    return ''
  if (bytes < 1024)
    return `${bytes} B`
  if (bytes < 1024 * 1024)
    return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isImageAttachment(message: ChatMessage) {
  return message.attachmentType?.startsWith('image/') ?? false
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

const isChannelPickerOpen = ref(false)
const browsableChannels = ref<BrowsableChatChannel[]>([])
const isLoadingBrowsable = ref(false)
const joiningChannelId = ref<string | null>(null)
const newChannelProjectId = ref<string | undefined>(undefined)
const newChannelName = ref('')
const isCreatingChannel = ref(false)

async function openChannelPicker() {
  isChannelPickerOpen.value = true
  newChannelProjectId.value = undefined
  newChannelName.value = ''
  isLoadingBrowsable.value = true
  try {
    if (!projects.value.length)
      await fetchProjects()
    browsableChannels.value = await fetchBrowsableChannels()
  }
  finally {
    isLoadingBrowsable.value = false
  }
}

async function onJoinChannel(channelId: string) {
  joiningChannelId.value = channelId
  try {
    await joinChannel(channelId)
    browsableChannels.value = browsableChannels.value.map(c => c.id === channelId ? { ...c, joined: true } : c)
  }
  catch (error: any) {
    toast.error('Could not join channel', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
  finally {
    joiningChannelId.value = null
  }
}

async function onCreateChannel() {
  if (!newChannelProjectId.value)
    return

  isCreatingChannel.value = true
  try {
    const channel = await createProjectChannel(newChannelProjectId.value, newChannelName.value.trim() || undefined)
    isChannelPickerOpen.value = false
    await selectChannel(channel.id)
  }
  catch (error: any) {
    toast.error('Could not create channel', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
  finally {
    isCreatingChannel.value = false
  }
}

async function onLeaveChannel() {
  if (!activeChannelId.value || activeChannel.value?.type !== 'project')
    return

  const channelId = activeChannelId.value
  backToList()
  await leaveChannel(channelId)
  toast('Left channel')
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

function authorInitials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('')
}

async function onToggleReaction(messageId: string, emoji: string) {
  if (!activeChannelId.value)
    return
  try {
    await toggleReaction(activeChannelId.value, messageId, emoji)
  }
  catch (error: any) {
    toast.error('Could not react to message', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
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
          <Button size="icon-sm" variant="ghost" aria-label="Browse or create channels" @click="openChannelPicker">
            <Icon name="i-lucide-hash" class="size-4" />
          </Button>
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
          <div class="flex items-center justify-between px-4 pt-3 pb-1 md:px-3">
            <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Channels</span>
            <button type="button" class="text-xs text-muted-foreground hover:text-foreground" @click="openChannelPicker">
              Browse
            </button>
          </div>
          <ChannelListItem
            v-for="channel in projectChannels"
            :key="channel.id"
            :channel="channel"
            :active="channel.id === activeChannelId"
            :current-user-id="currentUser?.id"
            @click="selectChannel(channel.id)"
          />
          <p v-if="!projectChannels.length" class="px-4 pb-3 text-sm text-muted-foreground md:px-3">
            No channels joined yet.
          </p>

          <span class="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:px-3">Direct Messages</span>
          <ChannelListItem
            v-for="channel in conversationChannels"
            :key="channel.id"
            :channel="channel"
            :active="channel.id === activeChannelId"
            :current-user-id="currentUser?.id"
            @click="selectChannel(channel.id)"
          />
          <p v-if="!conversationChannels.length" class="px-4 pb-6 text-center text-sm text-muted-foreground">
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
                <Icon v-if="activeChannel.type === 'project'" name="i-lucide-hash" class="size-4" />
                <template v-else>
                  {{ channelInitials(activeChannel) }}
                </template>
              </AvatarFallback>
            </Avatar>
            <PresenceDot v-if="activeChannel.type === 'direct'" :state="channelPresence(activeChannel)?.state" class="absolute -bottom-0.5 -right-0.5" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-medium truncate leading-tight">
              {{ channelDisplayName(activeChannel) }}
            </div>
            <div class="text-xs text-muted-foreground truncate leading-tight">
              <template v-if="activeChannel.type === 'project'">
                {{ activeChannel.members.length }} members<template v-if="activeChannel.projectName">
                  · {{ activeChannel.projectName }}
                </template>
              </template>
              <template v-else-if="activeChannel.type === 'group'">
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
          <Button v-if="activeChannel.type === 'project'" size="icon-sm" variant="ghost" class="shrink-0 text-destructive" aria-label="Leave channel" @click="onLeaveChannel">
            <Icon name="i-lucide-log-out" class="size-4" />
          </Button>
        </div>

        <MessageScrollerProvider :key="activeChannelId ?? undefined" :auto-scroll="true" default-scroll-position="end">
          <MessageScroller class="flex-1 min-h-0">
            <MessageScrollerViewport class="p-3 md:p-4">
              <MessageScrollerContent class="gap-0.5">
                <MessageScrollerItem
                  v-for="(message, index) in activeMessages"
                  :key="message.id"
                  :message-id="message.id"
                  :scroll-anchor="index === activeMessages.length - 1"
                  :class="isGroupStart(index) ? 'mt-3' : ''"
                >
                  <Message :align="message.authorId === currentUser?.id ? 'end' : 'start'">
                    <MessageAvatar v-if="isGroupEnd(index) && activeChannel.type === 'group' && message.authorId !== currentUser?.id">
                      <Avatar class="size-7">
                        <AvatarFallback class="text-[10px]">
                          {{ authorInitials(message.authorName) }}
                        </AvatarFallback>
                      </Avatar>
                    </MessageAvatar>
                    <MessageContent>
                      <MessageHeader v-if="isGroupStart(index) && activeChannel.type === 'group' && message.authorId !== currentUser?.id">
                        {{ message.authorName }}
                      </MessageHeader>
                      <Bubble
                        class="flex-row items-end gap-1"
                        :variant="message.authorId === currentUser?.id ? 'default' : 'muted'"
                        :align="message.authorId === currentUser?.id ? 'end' : 'start'"
                      >
                        <BubbleContent>
                          <MessageBody v-if="message.body" :body="message.body" />
                          <a
                            v-if="message.attachmentUrl && isImageAttachment(message)"
                            :href="message.attachmentUrl"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="mt-1 block"
                            :class="message.body && 'pt-1'"
                          >
                            <img :src="message.attachmentUrl" :alt="message.attachmentName" class="max-h-64 max-w-full rounded-lg object-contain">
                          </a>
                          <a
                            v-else-if="message.attachmentUrl"
                            :href="message.attachmentUrl"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="mt-1 flex items-center gap-1.5 rounded-md border border-current/15 px-2 py-1.5 text-xs hover:bg-black/5"
                            :class="message.body && 'mt-2'"
                          >
                            <Icon name="i-lucide-paperclip" class="h-3.5 w-3.5 shrink-0" />
                            <span class="truncate">{{ message.attachmentName }}</span>
                            <span class="shrink-0 opacity-70">{{ formatFileSize(message.attachmentSize) }}</span>
                          </a>
                          <BubbleReactions v-if="message.reactions.length" :align="message.authorId === currentUser?.id ? 'end' : 'start'">
                            <button
                              v-for="reaction in message.reactions"
                              :key="reaction.emoji"
                              type="button"
                              class="flex items-center gap-0.5 rounded-full px-1 transition-colors hover:bg-background/60"
                              :class="reaction.reactedByMe && 'ring-1 ring-primary'"
                              :title="reaction.staffNames.join(', ')"
                              @click="onToggleReaction(message.id, reaction.emoji)"
                            >
                              <span>{{ reaction.emoji }}</span>
                              <span class="text-[10px] text-muted-foreground">{{ reaction.count }}</span>
                            </button>
                          </BubbleReactions>
                        </BubbleContent>
                        <ReactionPicker @pick="(emoji) => onToggleReaction(message.id, emoji)" />
                      </Bubble>
                      <MessageFooter v-if="isGroupEnd(index)">
                        {{ metaLabel(message) }}
                      </MessageFooter>
                    </MessageContent>
                  </Message>
                </MessageScrollerItem>
              </MessageScrollerContent>
              <p v-if="!activeMessages.length" class="text-center text-sm text-muted-foreground py-6">
                No messages yet. Say hello!
              </p>
            </MessageScrollerViewport>
            <MessageScrollerButton />
          </MessageScroller>
        </MessageScrollerProvider>

        <div class="border-t bg-background shrink-0">
          <div v-if="pendingAttachment" class="flex items-center gap-2 px-3 pt-2 md:px-4">
            <div class="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs">
              <img v-if="pendingAttachmentPreviewUrl" :src="pendingAttachmentPreviewUrl" alt="" class="size-5 rounded object-cover">
              <Icon v-else name="i-lucide-paperclip" class="size-3.5" />
              <span class="max-w-40 truncate">{{ pendingAttachment.name }}</span>
              <button type="button" class="text-muted-foreground hover:text-foreground" @click="clearPendingAttachment">
                <Icon name="i-lucide-x" class="size-3.5" />
              </button>
            </div>
          </div>

          <form class="flex items-center gap-2 px-3 py-2.5 md:py-3" style="padding-bottom: max(0.625rem, env(safe-area-inset-bottom))" @submit.prevent="onSend">
            <input ref="attachmentInput" type="file" class="hidden" :accept="[...ALLOWED_ATTACHMENT_TYPES].join(',')" @change="onAttachmentChange">
            <Button type="button" size="icon-sm" variant="ghost" class="shrink-0 rounded-full" aria-label="Attach file" @click="onAttachmentButtonClick">
              <Icon name="i-lucide-paperclip" class="size-4" />
            </Button>
            <ReferencePicker @insert="onInsertReference" />
            <Input v-model="draft" placeholder="Message" class="flex-1 h-10 rounded-full border-none bg-muted focus-visible:ring-1" />
            <Button type="submit" size="icon" class="rounded-full shrink-0" :disabled="!draft.trim() && !pendingAttachment">
              <Icon name="i-lucide-send" class="size-4" />
            </Button>
          </form>
        </div>
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

    <Sheet v-model:open="isChannelPickerOpen">
      <SheetContent side="right" class="w-full sm:max-w-md p-6 overflow-y-auto">
        <SheetHeader class="p-0">
          <SheetTitle>Channels</SheetTitle>
          <SheetDescription>
            Channels are linked to a project — join one to follow along, or create a new one.
          </SheetDescription>
        </SheetHeader>

        <div class="flex flex-col gap-2 pt-4">
          <Label class="text-xs text-muted-foreground">Browse</Label>
          <p v-if="isLoadingBrowsable" class="text-sm text-muted-foreground">
            Loading…
          </p>
          <template v-else>
            <div v-for="channel in browsableChannels" :key="channel.id" class="flex items-center justify-between gap-2 rounded-md border p-2.5">
              <div class="flex items-center gap-2 min-w-0">
                <Icon name="i-lucide-hash" class="size-4 shrink-0 text-muted-foreground" />
                <div class="min-w-0">
                  <p class="truncate text-sm font-medium">
                    {{ channel.name }}
                  </p>
                  <p v-if="channel.projectName" class="truncate text-xs text-muted-foreground">
                    {{ channel.projectName }}
                  </p>
                </div>
              </div>
              <Button
                v-if="!channel.joined" size="sm" variant="outline" :disabled="joiningChannelId === channel.id"
                @click="onJoinChannel(channel.id)"
              >
                {{ joiningChannelId === channel.id ? 'Joining…' : 'Join' }}
              </Button>
              <Button v-else size="sm" variant="ghost" @click="isChannelPickerOpen = false; selectChannel(channel.id)">
                Open
              </Button>
            </div>
            <p v-if="!browsableChannels.length" class="text-sm text-muted-foreground">
              No channels yet — create the first one below.
            </p>
          </template>
        </div>

        <Separator class="my-4" />

        <div class="flex flex-col gap-4">
          <Label class="text-xs text-muted-foreground">Create a channel</Label>
          <div class="flex flex-col gap-1.5">
            <Label class="text-xs text-muted-foreground">Project</Label>
            <Select v-model="newChannelProjectId">
              <SelectTrigger class="w-full">
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="project in projects" :key="project.id" :value="project.id">
                  {{ project.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label class="text-xs text-muted-foreground">Channel Name (optional)</Label>
            <Input v-model="newChannelName" placeholder="Defaults to the project name" />
          </div>
          <Button :disabled="!newChannelProjectId || isCreatingChannel" @click="onCreateChannel">
            {{ isCreatingChannel ? 'Creating…' : 'Create Channel' }}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  </div>
</template>
