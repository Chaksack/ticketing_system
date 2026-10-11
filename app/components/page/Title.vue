<script setup lang="ts">
/**
 * List-page heading from the Canopy design: an optional "View" picker above a 44px title,
 * with filter tabs (or anything else) on the right via the `aside` slot.
 */
defineProps<{
  title: string
  description?: string
  /** Options for the "View" picker; leave out to hide it. */
  views?: readonly { value: string, label: string }[]
}>()

const view = defineModel<string>('view')
</script>

<template>
  <div class="flex flex-wrap items-end justify-between gap-3">
    <div class="min-w-0">
      <label v-if="views?.length" class="inline-flex items-center gap-2 text-[13px] text-muted-foreground">
        View
        <select
          v-model="view"
          class="h-8 rounded-lg border border-input bg-card px-2.5 text-sm font-medium text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring/50 dark:text-foreground"
        >
          <option v-for="option in views" :key="option.value" :value="option.value">{{ option.label }}</option>
        </select>
      </label>
      <h1 class="m-0 text-4xl font-black leading-none tracking-[-0.045em] text-foreground sm:text-[44px]" :class="views?.length ? 'mt-2' : ''">
        {{ title }}
      </h1>
      <p v-if="description" class="mt-2 text-muted-foreground">
        {{ description }}
      </p>
    </div>
    <slot name="aside" />
  </div>
</template>
