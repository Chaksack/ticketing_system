<script setup lang="ts">
/** Pill links between Marketing screens, like the design's Marketing header. */
const route = useRoute()
const LINKS = [
  { to: '/marketing/segments', label: 'Segments' },
  { to: '/marketing/journeys', label: 'Journeys' },
]
</script>

<template>
  <nav aria-label="Marketing" class="flex flex-wrap gap-1 self-start rounded-full bg-brand-forest p-1.5">
    <NuxtLink
      v-for="link in LINKS"
      :key="link.to"
      :to="link.to"
      class="rounded-full px-3.5 py-2 text-sm transition-colors"
      :class="route.path.startsWith(link.to) ? 'bg-brand-lime font-semibold text-brand-forest' : 'text-white hover:bg-white/10'"
      :aria-current="route.path === link.to ? 'page' : undefined"
    >
      {{ link.label }}
    </NuxtLink>
  </nav>
</template>
