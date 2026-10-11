<script setup lang="ts">
import type { NavVisibilityContext } from '~/composables/useVisibleNav'
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
  finance: 'Finance Executive',
  engineer: 'Engineer',
  engineering_coordinator: 'Engineering Coordinator',
  engineering_lead: 'Engineering Lead',
}

const { currentUser, currentOrg, isAdmin, isPlatformStaff } = useAuth()

const teams = computed(() => [
  {
    name: currentOrg.value?.name ?? 'Canopy',
    logo: '/brand/canopy-app-icon.svg',
    role: currentUser.value?.roles.map(role => ROLE_LABELS[role]).join(', ') ?? '',
  },
])

function isItemOrGroupVisible(item: NavLink | NavGroup | NavSectionTitle, admin: boolean, roles: StaffRole[], context: NavVisibilityContext) {
  if ('children' in item)
    return item.children.some(child => isNavItemVisible(child, admin, roles, context))
  return isNavItemVisible(item, admin, roles, context)
}

const visibleNavMenu = computed(() => navMenu
  .map(group => ({
    ...group,
    items: group.items.filter(item => isItemOrGroupVisible(item, isAdmin.value, currentUser.value?.roles ?? [], { apps: currentOrg.value?.apps, isPlatformStaff: isPlatformStaff.value })),
  }))
  .filter(group => group.items.length > 0))

const { sidebar } = useAppSettings()
</script>

<template>
  <Sidebar :collapsible="sidebar?.collapsible" :side="sidebar?.side" :variant="sidebar?.variant">
    <!-- Same forest band and height as the top bar, so the two read as one continuous bar. -->
    <SidebarHeader class="dark h-(--header-height) justify-center bg-brand-forest text-foreground">
      <LayoutSidebarNavHeader :teams="teams" />
    </SidebarHeader>
    <SidebarContent>
      <SidebarGroup v-for="(nav, indexGroup) in visibleNavMenu" :key="indexGroup">
        <SidebarGroupLabel v-if="nav.heading">
          {{ nav.heading }}
        </SidebarGroupLabel>
        <LayoutSidebarChatChannels v-if="nav.heading === 'Team'" />
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
