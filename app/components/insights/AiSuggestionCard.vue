<script setup lang="ts">
import type { RegardingType } from '~/types/interaction'
import type { OpportunitySuggestion } from '~/types/opportunity-suggestion'

const props = defineProps<{
  regardingType: RegardingType
  regardingId: string
}>()

const suggestion = ref<OpportunitySuggestion | null>(null)
const isLoading = ref(false)

async function load() {
  isLoading.value = true
  try {
    const { suggestion: result } = await $fetch<{ suggestion: OpportunitySuggestion }>('/api/ml/suggestion', {
      query: { regardingType: props.regardingType, regardingId: props.regardingId },
    })
    suggestion.value = result
  }
  catch {
    suggestion.value = null
  }
  finally {
    isLoading.value = false
  }
}

watch(() => [props.regardingType, props.regardingId], load, { immediate: true })

const urgencyStyle = computed(() => {
  switch (suggestion.value?.urgency) {
    case 'stalled':
      return 'border-destructive/30 bg-destructive/5'
    case 'follow_up':
      return 'border-amber-500/30 bg-amber-500/5'
    default:
      return 'border-primary/20 bg-primary/5'
  }
})
</script>

<template>
  <div v-if="isLoading" class="rounded-md border p-3 text-sm text-muted-foreground">
    <Icon name="i-lucide-sparkles" class="mr-1.5 inline size-3.5 align-[-2px]" />
    Analyzing…
  </div>
  <div v-else-if="suggestion" class="flex flex-col gap-1 rounded-md border p-3" :class="urgencyStyle">
    <div class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      <Icon name="i-lucide-sparkles" class="size-3.5" />
      AI Suggestion
    </div>
    <p class="text-sm font-medium">
      {{ suggestion.headline }}
    </p>
    <p class="text-sm text-muted-foreground">
      {{ suggestion.actionLabel }}
    </p>
    <p v-if="suggestion.winProbability === null && (regardingType === 'lead' || regardingType === 'tender')" class="text-[11px] text-muted-foreground/70">
      Win-probability model needs {{ suggestion.minTrainingExamples }} decided deals to train ({{ suggestion.trainingExamples }} so far).
    </p>
  </div>
</template>
