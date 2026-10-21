<script setup lang="ts">
import NumberFlow from '@number-flow/vue'

/**
 * A number that animates when it changes (NumberFlow), rendered as plain text on the server —
 * NumberFlow's markup only exists in the browser, so rendering it during SSR broke hydration.
 */
const props = defineProps<{ value: number, suffix?: string }>()
const text = computed(() => `${props.value.toLocaleString(APP_LOCALE)}${props.suffix ?? ''}`)
</script>

<template>
  <ClientOnly>
    <NumberFlow :value="value" :suffix="suffix" />
    <template #fallback>
      {{ text }}
    </template>
  </ClientOnly>
</template>
