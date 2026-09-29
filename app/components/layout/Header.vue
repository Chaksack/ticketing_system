<script setup lang="ts">
import type { AuthUser } from '~/composables/useAuth'
import { toast } from 'vue-sonner'

const route = useRoute()
const { isRefreshing, refreshAll, onAppRefresh } = useAppRefresh()
const currentUser = useState<AuthUser | null>('current-user')

// Roles/profile can change (e.g. an admin grants a role) — pick that up on refresh as well.
onAppRefresh(async () => {
  const { user } = await $fetch<{ user: AuthUser | null }>('/api/auth/me')
  currentUser.value = user
})

async function onRefresh() {
  await refreshAll()
  toast('Data refreshed')
}

function setLinks() {
  if (route.fullPath === '/') {
    return [{ title: 'Home', href: '/' }]
  }

  const segments = route.fullPath.split('/').filter(item => item !== '')

  const breadcrumbs = segments.map((item, index) => {
    const str = item.replace(/-/g, ' ')
    const title = str
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')

    return {
      title,
      href: `/${segments.slice(0, index + 1).join('/')}`,
    }
  })

  return [{ title: 'Home', href: '/' }, ...breadcrumbs]
}

const links = ref<{
  title: string
  href: string
}[]>(setLinks())

watch(() => route.fullPath, (val) => {
  if (val) {
    links.value = setLinks()
  }
})
</script>

<template>
  <header class="sticky top-0 md:peer-data-[variant=inset]:top-2 z-10 h-(--header-height) flex items-center gap-4 border-b bg-background px-4 md:px-6 md:rounded-tl-xl md:rounded-tr-xl">
    <div class="w-full flex items-center gap-4 h-4">
      <SidebarTrigger />
      <Separator orientation="vertical" />
      <BaseBreadcrumbCustom :links="links" />
    </div>
    <div class="ml-auto flex items-center gap-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="ghost" size="icon" aria-label="Refresh all data" :disabled="isRefreshing" @click="onRefresh">
              <Icon name="i-lucide-refresh-cw" class="h-4 w-4" :class="isRefreshing && 'animate-spin'" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Refresh all data</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <Search />
      <AssistantPanel />
      <LayoutHeaderChat />
      <LayoutHeaderNotifications />
      <slot />
    </div>
  </header>
</template>

<style scoped>

</style>
