<script setup lang="ts" generic="T extends string">
/** Segmented filter control from the design: a fog track with the active option in lime. */
const props = defineProps<{
  options: readonly { value: T, label: string, count?: number }[]
  label: string
}>()

const model = defineModel<T>({ required: true })

function onKeydown(event: KeyboardEvent, index: number) {
  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft')
    return
  event.preventDefault()
  const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + props.options.length) % props.options.length
  model.value = props.options[next]!.value
  const tabs = (event.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLElement>('[role=tab]')
  nextTick(() => tabs?.[next]?.focus())
}
</script>

<template>
  <div role="tablist" :aria-label="label" class="flex max-w-full flex-wrap gap-1 rounded-full bg-brand-fog p-1 dark:bg-muted">
    <button
      v-for="(option, index) in options"
      :key="option.value"
      type="button"
      role="tab"
      :aria-selected="model === option.value"
      :tabindex="model === option.value ? 0 : -1"
      class="min-h-9 rounded-full px-3.5 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      :class="model === option.value ? 'bg-brand-lime font-semibold text-brand-forest' : 'text-foreground hover:bg-black/5 dark:hover:bg-white/10'"
      @click="model = option.value"
      @keydown="onKeydown($event, index)"
    >
      {{ option.label }}<span v-if="option.count !== undefined" class="ml-1.5 tabular-nums">{{ option.count }}</span>
    </button>
  </div>
</template>
