<script setup lang="ts" generic="T extends string">
/**
 * The design's "Sales process" bar: each stage a pill, done ones filled forest, the current one
 * lime. Clicking a stage moves the record there (unless `readonly`).
 */
const props = defineProps<{
  stages: readonly { value: T, label: string }[]
  current: T
  label?: string
  readonly?: boolean
  /** Shown under the current stage, e.g. "12 days". */
  note?: string
}>()
const emit = defineEmits<{ select: [value: T] }>()
const currentIndex = computed(() => props.stages.findIndex(s => s.value === props.current))
</script>

<template>
  <ol :aria-label="label ?? 'Process'" class="m-0 grid list-none gap-1.5 p-0" :style="{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }">
    <li v-for="(stage, index) in stages" :key="stage.value" :aria-current="index === currentIndex ? 'step' : undefined">
      <button
        type="button"
        class="flex min-h-12 w-full flex-col items-start justify-center rounded-2xl px-3 py-2 text-left text-sm font-semibold transition-colors disabled:cursor-default"
        :class="index < currentIndex
          ? 'bg-brand-forest text-brand-lime'
          : index === currentIndex
            ? 'bg-brand-lime text-brand-forest ring-2 ring-brand-forest'
            : 'bg-brand-fog text-brand-forest hover:bg-brand-mist dark:bg-muted dark:text-foreground'"
        :disabled="readonly || index === currentIndex"
        :aria-label="readonly || index === currentIndex ? stage.label : `Move to ${stage.label}`"
        @click="emit('select', stage.value)"
      >
        <span class="flex items-center gap-1.5">
          <Icon v-if="index < currentIndex" name="i-lucide-check" class="size-3.5" />
          {{ stage.label }}
        </span>
        <span v-if="index === currentIndex && note" class="text-xs font-medium opacity-80">{{ note }}</span>
      </button>
    </li>
  </ol>
</template>
