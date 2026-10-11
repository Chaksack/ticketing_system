<script setup lang="ts">
/** The pill toolbar that sits above a list: put a `variant="lime"` primary action first, then ghost buttons. */
defineProps<{ label?: string }>()
</script>

<template>
  <div role="toolbar" :aria-label="label ?? 'Page actions'" class="flex max-w-full flex-wrap items-center gap-1.5 self-start rounded-full bg-card p-1.5 ring-1 ring-black/10 dark:ring-white/10">
    <slot />
  </div>
</template>
