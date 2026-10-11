<script setup lang="ts">
/**
 * The Canopy logo: the arch-over-a-stem mark plus the lowercase "canopy" wordmark.
 * `tone="auto"` (default) is forest on light backgrounds and lime on dark green — it follows the
 * `dark` scope (dark mode, and the forest top bar/sidebar band). Force it with `light` or `dark`.
 */
withDefaults(defineProps<{
  tone?: 'auto' | 'light' | 'dark'
  /** Mark size in px; the wordmark scales with it. */
  size?: number
  wordmark?: boolean
}>(), {
  tone: 'auto',
  size: 32,
  wordmark: true,
})

const TONE = {
  auto: { outer: 'fill-brand-forest dark:fill-brand-lime', inner: 'fill-brand-lime dark:fill-brand-forest', text: 'text-brand-forest dark:text-brand-lime' },
  light: { outer: 'fill-brand-forest', inner: 'fill-brand-lime', text: 'text-brand-forest' },
  dark: { outer: 'fill-brand-lime', inner: 'fill-brand-forest', text: 'text-brand-lime' },
} as const
</script>

<template>
  <span class="inline-flex items-center" :style="{ gap: `${Math.round(size * 0.28)}px` }">
    <svg :width="size" :height="size" viewBox="0 0 48 48" :role="wordmark ? undefined : 'img'" :aria-label="wordmark ? undefined : 'Canopy'" :aria-hidden="wordmark ? 'true' : undefined" class="shrink-0">
      <path d="M6 32a18 18 0 0 1 36 0z" :class="TONE[tone].outer" />
      <path d="M15 32a9 9 0 0 1 18 0z" :class="TONE[tone].inner" />
      <rect x="22" y="30" width="4" height="12" rx="2" :class="TONE[tone].outer" />
    </svg>
    <span
      v-if="wordmark"
      class="font-black leading-none tracking-[-0.05em]"
      :class="TONE[tone].text"
      :style="{ fontSize: `${Math.round(size * 0.82)}px` }"
    >canopy</span>
  </span>
</template>
