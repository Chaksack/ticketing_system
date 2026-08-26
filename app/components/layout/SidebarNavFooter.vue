<script setup lang="ts">
import { toast } from 'vue-sonner'
import { useSidebar } from '~/components/ui/sidebar'

defineProps<{
  user: {
    name: string
    email: string
    avatar?: string
  }
}>()

const { isMobile, setOpenMobile } = useSidebar()
const { logout } = useAuth()
const { isSupported, isSubscribed, checkSubscription, subscribe, unsubscribe } = usePush()

onMounted(() => {
  checkSubscription()
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

const showModalTheme = ref(false)
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
            <Avatar class="h-8 w-8 rounded-lg">
              <AvatarImage v-if="user.avatar" :src="user.avatar" :alt="user.name" />
              <AvatarFallback class="rounded-lg">
                {{ user.name.split(' ').map((n) => n[0]).join('') }}
              </AvatarFallback>
            </Avatar>
            <div class="grid flex-1 text-left text-sm leading-tight">
              <span class="truncate font-semibold">{{ user.name }}</span>
              <span class="truncate text-xs">{{ user.email }}</span>
            </div>
            <Icon name="i-lucide-chevrons-up-down" class="ml-auto size-4" />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          class="min-w-56 w-[--radix-dropdown-menu-trigger-width] rounded-lg"
          :side="isMobile ? 'bottom' : 'right'"
          align="end"
        >
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
