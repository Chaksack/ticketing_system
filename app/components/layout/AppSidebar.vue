<script setup lang="ts">
import type { NavGroup, NavLink, NavSectionTitle } from '~/types/nav'
import type { StaffRole } from '~/types/staff'
import { navMenu, navMenuBottom } from '~/constants/menus'

function resolveNavItemComponent(item: NavLink | NavGroup | NavSectionTitle): any {
  if ('children' in item)
    return resolveComponent('LayoutSidebarNavGroup')

  return resolveComponent('LayoutSidebarNavLink')
}

const ROLE_LABELS: Record<StaffRole, string> = {
  admin: 'Admin',
  agent: 'Agent',
  bd: 'BD Executive',
  sm: 'Sales & Marketing Exec',
}

const { currentUser, isAdmin } = useAuth()

const teams = computed(() => [
  {
    name: 'BD & SM Platform',
    logo: 'i-lucide-gallery-vertical-end',
    role: currentUser.value?.roles.map(role => ROLE_LABELS[role]).join(', ') ?? '',
  },
])

const visibleNavMenu = computed(() => navMenu
  .map(group => ({
    ...group,
    items: group.items.filter(item => isNavItemVisible(item, isAdmin.value, currentUser.value?.roles ?? [])),
  }))
  .filter(group => group.items.length > 0))

const { sidebar } = useAppSettings()
</script>

<template>
  <Sidebar :collapsible="sidebar?.collapsible" :side="sidebar?.side" :variant="sidebar?.variant">
    <SidebarHeader>
      <LayoutSidebarNavHeader :teams="teams" />
      <Search />
      <AssistantPanel />
    </SidebarHeader>
    <SidebarContent>
      <SidebarGroup v-for="(nav, indexGroup) in visibleNavMenu" :key="indexGroup">
        <SidebarGroupLabel v-if="nav.heading">
          {{ nav.heading }}
        </SidebarGroupLabel>
        <component :is="resolveNavItemComponent(item)" v-for="(item, index) in nav.items" :key="index" :item="item" />
      </SidebarGroup>
      <SidebarGroup class="mt-auto">
        <component :is="resolveNavItemComponent(item)" v-for="(item, index) in navMenuBottom" :key="index" :item="item" size="sm" />
      </SidebarGroup>
    </SidebarContent>
    <SidebarFooter>
      <LayoutSidebarNavFooter v-if="currentUser" :user="currentUser" />
    </SidebarFooter>
    <SidebarRail />
  </Sidebar>
</template>

<style scoped>
</style>
