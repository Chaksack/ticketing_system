<script setup lang="ts">
import { useSidebar } from '~/components/ui/sidebar'
import { channelDisplayName, channelIcon } from '~/lib/chatChannel'

const { setOpenMobile } = useSidebar()
const { currentUser } = useAuth()
const { channels, unreadCount, fetchChannels } = useChat()
const route = useRoute()

const isOnChatPage = computed(() => route.path === '/chat')
const openCollapsible = ref(isOnChatPage.value)

onMounted(() => {
  if (!channels.value.length)
    fetchChannels()
})

function isActiveChannel(channelId: string) {
  return isOnChatPage.value && route.query.channel === channelId
}
</script>

<template>
  <SidebarMenu>
    <Collapsible v-model:open="openCollapsible" as-child class="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger as-child>
          <SidebarMenuButton tooltip="Chat">
            <Icon name="i-lucide-message-square" mode="svg" />
            <span>Chat</span>
            <SidebarMenuBadge v-if="unreadCount > 0" class="static ml-auto mr-1">
              {{ unreadCount }}
            </SidebarMenuBadge>
            <Icon name="i-lucide-chevron-right" class="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" :class="unreadCount > 0 && 'ml-1'" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            <SidebarMenuSubItem>
              <SidebarMenuSubButton as-child :data-active="isOnChatPage && !route.query.channel">
                <NuxtLink to="/chat" @click="setOpenMobile(false)">
                  <Icon name="i-lucide-inbox" class="size-4" />
                  <span>All Chats</span>
                </NuxtLink>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          </SidebarMenuSub>
          <SidebarMenuSub class="max-h-72 overflow-y-auto">
            <SidebarMenuSubItem v-for="channel in channels" :key="channel.id">
              <SidebarMenuSubButton as-child :data-active="isActiveChannel(channel.id)">
                <NuxtLink :to="{ path: '/chat', query: { channel: channel.id } }" @click="setOpenMobile(false)">
                  <Icon :name="channelIcon(channel) ?? 'i-lucide-user'" class="size-4" />
                  <span class="truncate">{{ channelDisplayName(channel, currentUser?.id) }}</span>
                  <SidebarMenuBadge v-if="channel.unreadCount > 0" class="static ml-auto">
                    {{ channel.unreadCount }}
                  </SidebarMenuBadge>
                </NuxtLink>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  </SidebarMenu>
</template>
