<script setup lang="ts">
import { useSidebar } from '~/components/ui/sidebar'

/**
 * Name of the space you're in, on the forest band. Canopy staff can switch between Canopy HQ
 * (clients, onboarding, Canopy Care) and Canopy's own CRM workspace from here.
 */
defineProps<{
  name: string
  role: string
  spaces: { label: string, description: string, to: string, icon: string, active: boolean }[]
}>()

const { isMobile } = useSidebar()
</script>

<template>
  <SidebarMenu>
    <SidebarMenuItem>
      <DropdownMenu v-if="spaces.length > 1">
        <DropdownMenuTrigger as-child>
          <SidebarMenuButton size="lg" class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
            <div class="flex aspect-square size-8 items-center justify-center">
              <img src="/brand/canopy-app-icon.svg" alt="" class="size-full object-contain">
            </div>
            <div class="grid flex-1 text-left text-sm leading-tight">
              <span class="truncate font-black tracking-[-0.03em] text-brand-lime">{{ name }}</span>
              <span class="truncate text-xs text-brand-mist">{{ role }}</span>
            </div>
            <Icon name="i-lucide-chevrons-up-down" class="ml-auto" />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent class="w-[--radix-dropdown-menu-trigger-width] min-w-64 rounded-xl" align="start" :side="isMobile ? 'bottom' : 'right'">
          <DropdownMenuLabel class="text-xs text-muted-foreground">
            Switch to
          </DropdownMenuLabel>
          <DropdownMenuItem v-for="space in spaces" :key="space.to" as-child class="gap-2.5 p-2">
            <NuxtLink :to="space.to">
              <span class="flex size-8 shrink-0 items-center justify-center rounded-lg" :class="space.active ? 'bg-brand-lime text-brand-forest' : 'bg-muted'">
                <Icon :name="space.icon" class="size-4" />
              </span>
              <span class="flex min-w-0 flex-col">
                <span class="font-semibold">{{ space.label }}</span>
                <span class="truncate text-xs text-muted-foreground">{{ space.description }}</span>
              </span>
              <Icon v-if="space.active" name="i-lucide-check" class="ml-auto size-4" />
            </NuxtLink>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <SidebarMenuButton v-else size="lg" as-child>
        <div>
          <div class="flex aspect-square size-8 items-center justify-center">
            <img src="/brand/canopy-app-icon.svg" alt="" class="size-full object-contain">
          </div>
          <div class="grid flex-1 text-left text-sm leading-tight">
            <span class="truncate font-black tracking-[-0.03em] text-brand-lime">{{ name }}</span>
            <span class="truncate text-xs text-brand-mist">{{ role }}</span>
          </div>
        </div>
      </SidebarMenuButton>
    </SidebarMenuItem>
  </SidebarMenu>
</template>
