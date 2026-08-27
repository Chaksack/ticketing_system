<script setup lang="ts">
import { toast } from 'vue-sonner'
import { useSidebar } from '~/components/ui/sidebar'

const props = defineProps<{
  user: {
    id: string
    name: string
    email: string
    avatarUrl?: string
  }
}>()

const { isMobile, setOpenMobile } = useSidebar()
const { logout } = useAuth()
const { isSupported, isSubscribed, checkSubscription, subscribe, unsubscribe } = usePush()
const { getPresence, fetchPresences, sendHeartbeat, updateMyPresence } = usePresence()

const myPresence = computed(() => getPresence(props.user.id))
const myOverride = computed(() => myPresence.value?.state === 'in_meeting' ? 'in_meeting' : myPresence.value?.state === 'offline' ? 'offline' : 'auto')

let presenceTimer: ReturnType<typeof setInterval> | undefined

async function refreshPresence() {
  // Sequential, not concurrent — db0's postgresql connector shares a single client and warns
  // (and can wedge) on overlapping concurrent queries. A single interval (rather than separate
  // heartbeat/poll timers) also avoids two independent timers racing each other.
  await sendHeartbeat().catch(() => {})
  await fetchPresences().catch(() => {})
}

onMounted(async () => {
  checkSubscription()
  await refreshPresence()
  presenceTimer = setInterval(refreshPresence, 30_000)
})

onUnmounted(() => {
  clearInterval(presenceTimer)
})

async function handleLogout() {
  await logout()
  await navigateTo('/login')
}

async function handleToggleNotifications() {
  try {
    if (isSubscribed.value) {
      await unsubscribe()
      toast('Notifications disabled', {
        description: 'You will no longer receive push notifications on this device.',
      })
    }
    else {
      await subscribe()
      toast('Notifications enabled', {
        description: 'You will be paged on this device when new tickets come in.',
      })
    }
  }
  catch (error: any) {
    toast.error('Could not update notifications', {
      description: error?.message ?? 'Something went wrong. Please try again.',
    })
  }
}

async function onOverrideChange(value: unknown) {
  if (value === null || typeof value !== 'string')
    return

  await updateMyPresence({ override: value as 'auto' | 'in_meeting' | 'offline' })
}

const showModalTheme = ref(false)

const isStatusDialogOpen = ref(false)
const statusEmojiDraft = ref('')
const statusTextDraft = ref('')

function openStatusDialog() {
  statusEmojiDraft.value = myPresence.value?.statusEmoji ?? ''
  statusTextDraft.value = myPresence.value?.statusText ?? ''
  isStatusDialogOpen.value = true
}

async function onSaveStatus() {
  await updateMyPresence({
    statusEmoji: statusEmojiDraft.value.trim() || null,
    statusText: statusTextDraft.value.trim() || null,
  })
  isStatusDialogOpen.value = false
  toast('Status updated')
}

async function onClearStatus() {
  statusEmojiDraft.value = ''
  statusTextDraft.value = ''
  await updateMyPresence({ statusEmoji: null, statusText: null })
  isStatusDialogOpen.value = false
  toast('Status cleared')
}
</script>

<template>
  <SidebarMenu>
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <SidebarMenuButton
            size="lg"
            class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
          >
            <div class="relative">
              <Avatar class="h-8 w-8 rounded-lg">
                <AvatarImage v-if="user.avatarUrl" :src="user.avatarUrl" :alt="user.name" />
                <AvatarFallback class="rounded-lg">
                  {{ user.name.split(' ').map((n) => n[0]).join('') }}
                </AvatarFallback>
              </Avatar>
              <PresenceDot :state="myPresence?.state" class="absolute -bottom-0.5 -right-0.5" />
            </div>
            <div class="grid flex-1 text-left text-sm leading-tight">
              <span class="truncate font-semibold">{{ user.name }}</span>
              <span v-if="myPresence?.statusText" class="truncate text-xs">
                <span v-if="myPresence.statusEmoji">{{ myPresence.statusEmoji }}</span> {{ myPresence.statusText }}
              </span>
              <span v-else class="truncate text-xs">{{ user.email }}</span>
            </div>
            <Icon name="i-lucide-chevrons-up-down" class="ml-auto size-4" />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          class="min-w-56 w-[--radix-dropdown-menu-trigger-width] rounded-lg"
          :side="isMobile ? 'bottom' : 'right'"
          align="end"
        >
          <DropdownMenuLabel class="text-xs font-normal text-muted-foreground">
            Status
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup :model-value="myOverride" @update:model-value="onOverrideChange">
            <DropdownMenuRadioItem value="auto">
              <PresenceDot state="online" class="mr-1" />
              Active
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="in_meeting">
              <PresenceDot state="in_meeting" class="mr-1" />
              In a meeting
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="offline">
              <PresenceDot state="offline" class="mr-1" />
              Offline
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuItem @select.prevent="openStatusDialog">
            <Icon name="i-lucide-smile" />
            {{ myPresence?.statusText ? 'Edit status message' : 'Set a status message' }}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem as-child>
              <NuxtLink to="/settings" @click="setOpenMobile(false)">
                <Icon name="i-lucide-settings" />
                Settings
              </NuxtLink>
            </DropdownMenuItem>
            <DropdownMenuItem v-if="isSupported" @click="handleToggleNotifications">
              <Icon name="i-lucide-bell" />
              {{ isSubscribed ? 'Disable Notifications' : 'Enable Notifications' }}
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem @click="handleLogout">
            <Icon name="i-lucide-log-out" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  </SidebarMenu>

  <Dialog v-model:open="isStatusDialogOpen">
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>Set a status message</DialogTitle>
        <DialogDescription class="text-xs text-muted-foreground">
          Shown next to your name across the app.
        </DialogDescription>
      </DialogHeader>
      <div class="flex gap-2">
        <Input v-model="statusEmojiDraft" placeholder="🌴" class="w-16 text-center" maxlength="4" />
        <Input v-model="statusTextDraft" placeholder="On vacation until Friday" class="flex-1" maxlength="80" />
      </div>
      <DialogFooter class="gap-2 sm:justify-between">
        <Button v-if="myPresence?.statusText" variant="ghost" @click="onClearStatus">
          Clear status
        </Button>
        <Button class="ml-auto" @click="onSaveStatus">
          Save
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <Dialog v-model:open="showModalTheme">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Customize</DialogTitle>
        <DialogDescription class="text-xs text-muted-foreground">
          Customize & Preview in Real Time
        </DialogDescription>
      </DialogHeader>
      <ThemeCustomize />
    </DialogContent>
  </Dialog>
</template>

<style scoped>

</style>
