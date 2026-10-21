<script setup lang="ts">
import type { NavVisibilityContext } from '~/composables/useVisibleNav'
import type { NavGroup, NavLink, NavSectionTitle } from '~/types/nav'
import type { StaffRole } from '~/types/staff'
import { HQ_PREFIXES, hqMenu, navMenu, navMenuBottom } from '~/constants/menus'

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

const { currentUser, currentOrg, isAdmin, isPlatformStaff, workspacePath } = useAuth()
const route = useRoute()

/** Canopy staff on an HQ page see the HQ menu; everywhere else, the company workspace menu. */
const inHq = computed(() => !!currentOrg.value?.isHome && HQ_PREFIXES.some(prefix => route.path === prefix || route.path.startsWith(`${prefix}/`)))
const role = computed(() => currentUser.value?.roles.map(r => ROLE_LABELS[r]).join(', ') ?? '')
const spaces = computed(() => currentOrg.value?.isHome
  ? [
      { label: 'Canopy HQ', description: 'Clients, onboarding and Canopy Care', to: '/hq', icon: 'i-lucide-radar', active: inHq.value },
      { label: 'Canopy workspace', description: 'Canopy\'s own sales, leads and support', to: workspacePath.value, icon: 'i-lucide-briefcase-business', active: !inHq.value },
    ]
  : [])

function isItemOrGroupVisible(item: NavLink | NavGroup | NavSectionTitle, admin: boolean, roles: StaffRole[], context: NavVisibilityContext) {
  if ('children' in item)
    return item.children.some(child => isNavItemVisible(child, admin, roles, context))
  return isNavItemVisible(item, admin, roles, context)
}

const visibleNavMenu = computed(() => (inHq.value ? hqMenu : navMenu)
  .map(group => ({
    ...group,
    items: group.items.filter(item => isItemOrGroupVisible(item, isAdmin.value, currentUser.value?.roles ?? [], { apps: currentOrg.value?.apps, isPlatformStaff: isPlatformStaff.value, isHomeOrg: !!currentOrg.value?.isHome })),
  }))
  .filter(group => group.items.length > 0))

const { sidebar } = useAppSettings()
</script>

<template>
  <Sidebar :collapsible="sidebar?.collapsible" :side="sidebar?.side" :variant="sidebar?.variant">
    <!-- Same forest band and height as the top bar, so the two read as one continuous bar. -->
    <SidebarHeader class="dark h-(--header-height) justify-center bg-brand-forest text-foreground">
      <LayoutSidebarNavHeader :name="inHq ? 'Canopy HQ' : (currentOrg?.name ?? 'Canopy')" :role="inHq ? 'Internal' : role" :spaces="spaces" />
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
        <SidebarMenu v-if="currentOrg?.isHome">
          <SidebarMenuItem>
            <SidebarMenuButton as-child size="sm" class="bg-brand-mist font-semibold text-brand-forest hover:bg-brand-lime dark:bg-brand-spruce dark:text-brand-mist">
              <NuxtLink :to="inHq ? workspacePath : '/hq'">
                <Icon :name="inHq ? 'i-lucide-briefcase-business' : 'i-lucide-radar'" />
                {{ inHq ? 'Go to Canopy workspace' : 'Go to Canopy HQ' }}
              </NuxtLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
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
