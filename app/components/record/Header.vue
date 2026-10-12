<script setup lang="ts">
/**
 * Top of a record page: eyebrow line, 44px name, subtitle and key figures — on white (lead,
 * opportunity) or forest (account 360) like the design. Put a RecordStageBar in the default slot.
 */
withDefaults(defineProps<{
  eyebrow?: string
  title: string
  subtitle?: string
  stats?: { label: string, value: string }[]
  tone?: 'white' | 'forest'
  /** Shows a lime monogram tile (account style). */
  monogram?: string
}>(), { tone: 'white' })
</script>

<template>
  <section
    class="flex flex-col gap-5 rounded-[28px] p-5 sm:px-7 sm:py-6"
    :class="tone === 'forest' ? 'dark bg-brand-forest text-white' : 'bg-card ring-1 ring-black/10 dark:ring-white/10'"
  >
    <div class="flex flex-wrap items-end justify-between gap-5">
      <div class="flex min-w-0 items-center gap-4">
        <div v-if="monogram" aria-hidden="true" class="flex size-[72px] shrink-0 items-center justify-center rounded-[22px] bg-brand-lime text-3xl font-black tracking-[-0.04em] text-brand-forest">
          {{ monogram }}
        </div>
        <div class="min-w-0">
          <div v-if="eyebrow" class="text-[13px] font-semibold" :class="tone === 'forest' ? 'text-brand-mist' : 'text-muted-foreground'">
            {{ eyebrow }}
          </div>
          <h1 class="m-0 mt-1 break-words text-4xl font-black leading-none tracking-[-0.045em] sm:text-[44px]" :class="tone === 'forest' ? 'text-white' : 'text-foreground'">
            {{ title }}
          </h1>
          <div v-if="subtitle" class="mt-1.5 text-[15px]" :class="tone === 'forest' ? 'text-brand-mist' : ''">
            {{ subtitle }}
          </div>
          <slot name="meta" />
        </div>
      </div>
      <dl v-if="stats?.length" class="m-0 flex flex-wrap gap-x-8 gap-y-3">
        <div v-for="stat in stats" :key="stat.label">
          <dt class="text-[13px]" :class="tone === 'forest' ? 'text-brand-mist' : 'text-muted-foreground'">
            {{ stat.label }}
          </dt>
          <dd class="m-0 text-xl font-black tracking-[-0.02em]" :class="tone === 'forest' ? 'text-brand-lime' : 'text-foreground'">
            {{ stat.value }}
          </dd>
        </div>
      </dl>
    </div>
    <slot />
  </section>
</template>
