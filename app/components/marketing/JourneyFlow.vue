<script setup lang="ts">
import type { JourneyStep } from '~/types/marketing'
import { BRANCH_LABELS, JOURNEY_STEP_LABELS } from '~/types/marketing'

/** The journey's step tree drawn as the design's vertical flow; branches split into Yes / No columns. */
defineProps<{ steps: JourneyStep[], selectedId: string | null }>()
const emit = defineEmits<{ select: [id: string] }>()

function title(step: JourneyStep) {
  switch (step.type) {
    case 'email': return step.subject || 'Untitled email'
    case 'wait': return `Wait ${step.days} day${step.days === 1 ? '' : 's'}`
    case 'branch': return step.condition === 'lead_stage_is' ? `Lead reached "${step.value ?? '…'}"?` : BRANCH_LABELS[step.condition]
    case 'create_lead': return 'Create lead · auto-assign'
    case 'notify_owner': return step.message
  }
}
</script>

<template>
  <div class="flex w-full flex-col items-center">
    <template v-for="step in steps" :key="step.id">
      <div aria-hidden="true" class="h-7 w-0.5 bg-brand-forest dark:bg-brand-lime" />
      <button
        v-if="step.type === 'wait'"
        type="button"
        class="rounded-full bg-card px-4 py-2 text-[13px] font-semibold text-brand-forest ring-1 dark:text-foreground"
        :class="selectedId === step.id ? 'ring-2 ring-brand-forest dark:ring-brand-lime' : 'ring-black/10'"
        @click="emit('select', step.id)"
      >
        {{ title(step) }}
      </button>
      <template v-else-if="step.type === 'branch'">
        <button
          type="button"
          class="w-[300px] max-w-full rounded-2xl bg-brand-lime px-4 py-3.5 text-left text-brand-forest"
          :class="selectedId === step.id ? 'ring-2 ring-brand-forest ring-offset-2' : ''"
          @click="emit('select', step.id)"
        >
          <span class="block text-[11px] font-bold uppercase tracking-[0.08em]">Branch</span>
          <span class="mt-1 block font-semibold">{{ title(step) }}</span>
        </button>
        <div aria-hidden="true" class="h-7 w-3/5 rounded-t-2xl border-2 border-b-0 border-brand-forest dark:border-brand-lime" />
        <div class="grid w-full grid-cols-2 gap-4">
          <div v-for="side in (['yes', 'no'] as const)" :key="side" class="flex min-w-0 flex-col items-center">
            <span class="text-xs font-bold text-brand-forest dark:text-brand-lime">{{ side === 'yes' ? 'Yes' : 'No' }}</span>
            <JourneyFlow v-if="step[side].length" :steps="step[side]" :selected-id="selectedId" @select="(id: string) => emit('select', id)" />
            <span v-else class="mt-2 rounded-full bg-card px-3 py-1.5 text-xs text-muted-foreground ring-1 ring-black/10">Ends here</span>
          </div>
        </div>
      </template>
      <button
        v-else
        type="button"
        class="w-[300px] max-w-full rounded-2xl px-4 py-3.5 text-left"
        :class="[
          step.type === 'create_lead' ? 'bg-brand-forest text-white' : 'bg-card text-foreground ring-1 ring-black/10 dark:ring-white/10',
          selectedId === step.id ? 'ring-2 ring-brand-forest ring-offset-2 dark:ring-brand-lime' : '',
        ]"
        @click="emit('select', step.id)"
      >
        <span class="block text-[11px] font-bold uppercase tracking-[0.08em]" :class="step.type === 'create_lead' ? 'text-brand-lime' : 'text-muted-foreground'">{{ step.type === 'create_lead' ? 'Sales handoff' : JOURNEY_STEP_LABELS[step.type] }}</span>
        <span class="mt-1 block truncate font-semibold">{{ title(step) }}</span>
      </button>
    </template>
  </div>
</template>
