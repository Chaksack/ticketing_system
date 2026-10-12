<script setup lang="ts">
/** Pill links between the Field Service screens (Schedule board · Work orders · Assets). */
const route = useRoute()
const { isAdmin, currentUser } = useAuth()
const dispatcher = computed(() => isAdmin.value || (currentUser.value?.roles ?? []).some(r => ['agent', 'engineering_coordinator', 'engineering_lead'].includes(r)))
const links = computed(() => [
  ...(dispatcher.value ? [{ to: '/field', label: 'Schedule board' }] : []),
  { to: '/field/work-orders', label: dispatcher.value ? 'Work orders' : 'My work orders' },
  { to: '/field/assets', label: 'Assets' },
])
</script>

<template>
  <nav aria-label="Field Service" class="flex flex-wrap gap-1 self-start rounded-full bg-brand-forest p-1.5">
    <NuxtLink
      v-for="link in links"
      :key="link.to"
      :to="link.to"
      class="rounded-full px-3.5 py-2 text-sm transition-colors"
      :class="route.path === link.to ? 'bg-brand-lime font-semibold text-brand-forest' : 'text-white hover:bg-white/10'"
      :aria-current="route.path === link.to ? 'page' : undefined"
    >
      {{ link.label }}
    </NuxtLink>
  </nav>
</template>
