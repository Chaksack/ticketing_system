<script setup lang="ts">
/** A record-page panel from the Canopy design: white (default), mist or forest, 28px corners. */
withDefaults(defineProps<{ title?: string, tone?: 'white' | 'mist' | 'forest' }>(), { tone: 'white' })
</script>

<template>
  <section
    class="flex min-w-0 flex-col gap-3 rounded-[28px] p-5 sm:p-6"
    :class="{
      'bg-card ring-1 ring-black/10 dark:ring-white/10': tone === 'white',
      'bg-brand-mist text-brand-forest dark:bg-brand-spruce dark:text-brand-mist': tone === 'mist',
      'dark bg-brand-forest text-white': tone === 'forest',
    }"
  >
    <div v-if="title || $slots.actions" class="flex flex-wrap items-center justify-between gap-2">
      <h2 v-if="title" class="m-0 text-lg font-bold" :class="tone === 'white' ? 'text-foreground' : ''">
        {{ title }}
      </h2>
      <slot name="actions" />
    </div>
    <slot />
  </section>
</template>
