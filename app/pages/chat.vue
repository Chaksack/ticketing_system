<script setup lang="ts">
import { toast } from 'vue-sonner'
import MessageBody from '~/components/chat/MessageBody.vue'
import ReferencePicker from '~/components/chat/ReferencePicker.vue'

const { currentUser } = useAuth()
const { staff, fetchStaff } = useStaff()
const { channels, messagesByChannel, fetchChannels, openDirectChannel, createGroupChannel, updateChannel, fetchMessages, sendMessage, markRead } = useChat()
const { getPresence, fetchPresences } = usePresence()
const route = useRoute()
const router = useRouter()

const activeChannelId = ref<string | null>(null)
const activeMessages = computed(() => activeChannelId.value ? (messagesByChannel.value[activeChannelId.value] ?? []) : [])
const activeChannel = computed(() => channels.value.find(c => c.id === activeChannelId.value) ?? null)

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
  else if (channels.value.length) {
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

function formatMessageTime(value: string) {
  return new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
</script>

<template>
  <div class="w-full flex h-[calc(100vh-var(--header-height)-3rem)] gap-4">
    <div class="w-72 shrink-0 flex flex-col gap-2 border rounded-md p-2">
      <div class="flex items-center gap-1.5">
        <Popover v-model:open="isNewDmOpen">
          <PopoverTrigger as-child>
            <Button size="sm" variant="outline" class="flex-1 gap-1.5">
              <Icon name="i-lucide-user-plus" class="size-3.5" />
              Direct
            </Button>
          </PopoverTrigger>
          <PopoverContent class="w-[260px] p-0" align="start">
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
        <Button size="sm" variant="outline" class="flex-1 gap-1.5" @click="isNewGroupOpen = true">
          <Icon name="i-lucide-users" class="size-3.5" />
          Group
        </Button>
      </div>

      <ScrollArea class="flex-1 min-h-0">
        <div class="flex flex-col gap-0.5 pr-2">
          <button
            v-for="channel in channels"
            :key="channel.id"
            type="button"
            class="flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent"
            :class="{ 'bg-accent': channel.id === activeChannelId }"
            @click="selectChannel(channel.id)"
          >
            <div class="relative shrink-0">
              <Avatar class="size-8">
                <AvatarFallback class="text-xs">
                  {{ channelInitials(channel) }}
                </AvatarFallback>
              </Avatar>
              <PresenceDot :state="channelPresence(channel)?.state" class="absolute -bottom-0.5 -right-0.5" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between gap-1">
                <span class="truncate font-medium">{{ channelDisplayName(channel) }}</span>
                <Badge v-if="channel.unreadCount > 0" variant="default" class="h-5 min-w-5 justify-center px-1 text-[10px]">
                  {{ channel.unreadCount }}
                </Badge>
              </div>
              <p v-if="channel.lastMessage" class="truncate text-xs text-muted-foreground">
                {{ channel.lastMessage.authorName }}: {{ channel.lastMessage.body }}
              </p>
            </div>
          </button>
          <p v-if="!channels.length" class="px-2 py-6 text-center text-sm text-muted-foreground">
            No conversations yet. Start a direct message or group above.
          </p>
        </div>
      </ScrollArea>
    </div>

    <div class="flex-1 flex flex-col border rounded-md min-w-0">
      <template v-if="activeChannel">
        <div class="flex items-center justify-between border-b px-4 py-3">
          <div class="flex items-center gap-2">
            <span class="font-medium">{{ channelDisplayName(activeChannel) }}</span>
            <span v-if="activeChannel.type === 'group'" class="text-xs text-muted-foreground">
              {{ activeChannel.members.length }} members
            </span>
            <template v-else-if="channelPresence(activeChannel)">
              <PresenceDot :state="channelPresence(activeChannel)?.state" size="md" />
              <span class="text-xs text-muted-foreground">
                <template v-if="channelPresence(activeChannel)?.statusText">
                  <span v-if="channelPresence(activeChannel)?.statusEmoji">{{ channelPresence(activeChannel)?.statusEmoji }}</span>
                  {{ channelPresence(activeChannel)?.statusText }}
                </template>
              </span>
            </template>
          </div>
          <Button v-if="activeChannel.type === 'group'" size="sm" variant="ghost" @click="openEditGroup">
            <Icon name="i-lucide-settings" class="size-4" />
          </Button>
        </div>

        <div ref="messageListEl" class="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 p-4">
          <div v-for="message in activeMessages" :key="message.id" class="flex flex-col gap-0.5" :class="{ 'items-end': message.authorId === currentUser?.id }">
            <div
              class="max-w-[75%] rounded-lg px-3 py-2 text-sm"
              :class="message.authorId === currentUser?.id ? 'bg-primary text-primary-foreground' : 'bg-muted'"
            >
              <MessageBody :body="message.body" />
            </div>
            <span class="text-[10px] text-muted-foreground px-1">
              {{ message.authorId === currentUser?.id ? 'You' : message.authorName }} · {{ formatMessageTime(message.createdAt) }}
            </span>
          </div>
          <p v-if="!activeMessages.length" class="text-center text-sm text-muted-foreground py-6">
            No messages yet. Say hello!
          </p>
        </div>

        <form class="flex items-center gap-2 border-t p-3" @submit.prevent="onSend">
          <ReferencePicker @insert="onInsertReference" />
          <Input v-model="draft" placeholder="Write a message…" class="flex-1" />
          <Button type="submit" size="icon-sm" :disabled="!draft.trim()">
            <Icon name="i-lucide-send" class="size-4" />
          </Button>
        </form>
      </template>
      <div v-else class="flex-1 flex items-center justify-center text-sm text-muted-foreground">
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
