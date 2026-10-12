<script setup lang="ts">
/** Pill links between the Canopy Care operations screens. */
const route = useRoute()
const { isPlatformStaff } = useAuth()
const links = computed(() => [
  ...(isPlatformStaff.value ? [{ to: '/care', label: 'Engagements' }] : []),
  { to: '/care/desktop', label: 'Agent desktop' },
  ...(isPlatformStaff.value ? [{ to: '/care/quality', label: 'Quality' }, { to: '/care/workforce', label: 'Workforce' }] : []),
])
const active = (to: string) => to === '/care' ? route.path === '/care' || route.path.startsWith('/care/engagements') : route.path.startsWith(to)
</script>

<template>
  <nav aria-label="Canopy Care" class="flex flex-wrap items-center gap-1 self-start rounded-full bg-brand-forest p-1.5">
    <span class="px-3 text-sm font-black tracking-[-0.03em] text-brand-lime">canopy care</span>
    <NuxtLink
      v-for="link in links"
      :key="link.to"
      :to="link.to"
      class="rounded-full px-3.5 py-2 text-sm transition-colors"
      :class="active(link.to) ? 'bg-brand-lime font-semibold text-brand-forest' : 'text-white hover:bg-white/10'"
      :aria-current="active(link.to) ? 'page' : undefined"
    >
      {{ link.label }}
    </NuxtLink>
  </nav>
</template>
