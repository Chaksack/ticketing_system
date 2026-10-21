<script setup lang="ts">
import type { NavVisibilityContext } from '~/composables/useVisibleNav'
import type { NavArea } from '~/constants/menus'
import type { NavGroup, NavLink, NavSectionTitle } from '~/types/nav'
import type { StaffRole } from '~/types/staff'
import { HQ_PREFIXES, hqMenu, navAreas, navMenuBottom } from '~/constants/menus'

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

const navContext = computed(() => ({ apps: currentOrg.value?.apps, isPlatformStaff: isPlatformStaff.value, isHomeOrg: !!currentOrg.value?.isHome }))
function visibleGroups(menu: NavArea['menu']) {
  return menu
    .map(group => ({ ...group, items: group.items.filter(item => isItemOrGroupVisible(item, isAdmin.value, currentUser.value?.roles ?? [], navContext.value)) }))
    .filter(group => group.items.length > 0)
}

// ── Areas (Dynamics 365 "Change area") ──────────────────────────────────────
/** Areas this person can use: the company has the app, and at least one page beyond "My work" is theirs. */
const areas = computed(() => navAreas
  .filter(area => !area.app || !currentOrg.value?.apps || currentOrg.value.apps.includes(area.app))
  .map(area => ({ ...area, groups: visibleGroups(area.menu) }))
  .filter(area => area.groups.some(group => group.heading !== 'My work')))

// A cookie (not localStorage) so the server renders the same area the browser will.
const chosenArea = useCookie<string | null>('canopy-area', { default: () => null, maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
const linkMatches = (link: string, path: string) => path === link || path.startsWith(`${link}/`)
const ownGroups = (area: (typeof areas.value)[number]) => area.groups.filter(group => group.heading !== 'My work')
/** The area that owns the current page wins; shared pages (Calendar, Email…) keep the last area. */
const currentArea = computed(() => {
  const owning = areas.value.filter(area => ownGroups(area).some(group => group.items.some(item => 'link' in item && linkMatches(item.link, route.path))))
  return owning.find(a => a.id === chosenArea.value) ?? owning[0] ?? areas.value.find(a => a.id === chosenArea.value) ?? areas.value[0]
})
// Remember the area of every page visited (not just explicit switches).
watch(() => currentArea.value?.id, (id) => {
  if (id && !inHq.value && id !== chosenArea.value)
    chosenArea.value = id
}, { immediate: true })
function switchArea(area: (typeof areas.value)[number]) {
  chosenArea.value = area.id
  // Open the area's own first page (not a shared "My work" one), like Dynamics does.
  const first = ownGroups(area).flatMap(g => g.items).find(item => 'link' in item)
  if (first && 'link' in first)
    navigateTo(first.link)
}

const visibleNavMenu = computed(() => inHq.value ? visibleGroups(hqMenu) : (currentArea.value?.groups ?? []))

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
        <LayoutSidebarChatChannels v-if="nav.heading === 'My work'" />
        <component :is="resolveNavItemComponent(item)" v-for="(item, index) in nav.items" :key="index" :item="item" />
      </SidebarGroup>
      <SidebarGroup class="mt-auto">
        <!-- Change area, as in Dynamics 365 -->
        <SidebarMenu v-if="!inHq && areas.length > 1 && currentArea">
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <SidebarMenuButton class="h-11 justify-between rounded-xl border border-sidebar-border bg-sidebar font-semibold" aria-label="Change area">
                  <span class="flex items-center gap-2">
                    <span class="flex size-7 items-center justify-center rounded-lg bg-brand-forest text-brand-lime">
                      <Icon :name="currentArea.icon" class="size-4" />
                    </span>
                    {{ currentArea.label }}
                  </span>
                  <Icon name="i-lucide-chevrons-up-down" class="size-4 text-muted-foreground" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" class="w-[--reka-dropdown-menu-trigger-width] min-w-56 rounded-xl">
                <DropdownMenuLabel class="text-xs text-muted-foreground">
                  Change area
                </DropdownMenuLabel>
                <DropdownMenuItem v-for="area in areas" :key="area.id" class="gap-2.5 p-2" @select="switchArea(area)">
                  <span class="flex size-7 items-center justify-center rounded-lg" :class="area.id === currentArea.id ? 'bg-brand-lime text-brand-forest' : 'bg-muted'">
                    <Icon :name="area.icon" class="size-4" />
                  </span>
                  <span class="font-medium">{{ area.label }}</span>
                  <Icon v-if="area.id === currentArea.id" name="i-lucide-check" class="ml-auto size-4" />
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
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
