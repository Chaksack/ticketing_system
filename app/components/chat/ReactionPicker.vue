<script setup lang="ts">
import { QUICK_REACTIONS } from '~/types/chat'

const emit = defineEmits<{
  pick: [emoji: string]
}>()

const isOpen = ref(false)

function onPick(emoji: string) {
  emit('pick', emoji)
  isOpen.value = false
}
</script>

<template>
  <Popover v-model:open="isOpen">
    <PopoverTrigger as-child>
      <Button
        type="button" size="icon-sm" variant="ghost"
        class="size-6 shrink-0 self-center rounded-full text-muted-foreground opacity-60 transition-opacity md:opacity-0 md:group-hover/bubble:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
        aria-label="Add reaction"
      >
        <Icon name="i-lucide-smile-plus" class="size-3.5" />
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-auto p-1" align="start">
      <div class="flex items-center gap-0.5">
        <button
          v-for="emoji in QUICK_REACTIONS"
          :key="emoji"
          type="button"
          class="rounded-md p-1.5 text-lg leading-none transition-colors hover:bg-accent"
          @click="onPick(emoji)"
        >
          {{ emoji }}
        </button>
      </div>
    </PopoverContent>
  </Popover>
</template>
